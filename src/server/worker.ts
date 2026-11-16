import { getDatabase, saveDatabase } from './db';
import {
  MailboxAccount,
  FailureType,
  SendingJob,
  InboundMessage,
  Conversation,
} from '../types';
import { sendGmailMessage, syncGmailReplies, AdapterSendResult } from './adapters/gmailAdapter';
import { sendMicrosoftGraphMessage, syncMicrosoftReplies } from './adapters/microsoftAdapter';
import {
  sendSmtpMessage,
  syncImapReplies,
  verifySmtpConnection,
  provisionControlledTestMailbox,
} from './adapters/smtpImapAdapter';
import {
  getDueJobs,
  markJobProcessing,
  markJobSent,
  markJobFailed,
  getQueueStats,
} from './queue';
import { enrollAllActiveCampaigns } from './scheduler';
import { selectNextMailbox } from '../utils/senderRotation';
import { composeOutboundEmail } from '../utils/emailComposer';
import {
  buildOpenTrackingPixelUrl,
  generateTrackingToken,
  resolveTrackingBaseUrl,
} from '../utils/openTracking';

export interface SendResult {
  success: boolean;
  messageId: string;
  provider: string;
  error?: string;
  errorDetails?: string;
  failureType?: FailureType;
  previewUrl?: string;
}

/**
 * Dispatches an email using the real provider adapter (Gmail API, MS Graph, or SMTP)
 * STRICT: Does NOT simulate successful delivery. Returns actual provider result or real error.
 */
export async function dispatchRealEmail(
  mailboxId: string,
  to: string,
  subject: string,
  htmlOrText: string,
  trackingHeaders?: Record<string, string>,
  options?: { textBody?: string; plainTextOnly?: boolean; includeUnsubscribeHeader?: boolean }
): Promise<SendResult> {
  const db = getDatabase();
  const mailbox = db.mailboxes.find((m) => m.id === mailboxId);
  if (!mailbox) {
    return {
      success: false,
      messageId: '',
      provider: 'unknown',
      failureType: 'unknown',
      error: `Mailbox account not found: ${mailboxId}`,
    };
  }

  // Check provider daily limit
  if (mailbox.sentToday >= mailbox.dailyLimit) {
    return {
      success: false,
      messageId: '',
      provider: mailbox.provider,
      failureType: 'quota_exceeded',
      error: `Mailbox daily quota exhausted (${mailbox.sentToday}/${mailbox.dailyLimit})`,
    };
  }

  let result: AdapterSendResult & { previewUrl?: string };

  if (mailbox.provider === 'gmail') {
    result = await sendGmailMessage(mailbox, to, subject, htmlOrText, trackingHeaders, options);
  } else if (mailbox.provider === 'outlook') {
    result = await sendMicrosoftGraphMessage(mailbox, to, subject, htmlOrText, trackingHeaders);
  } else {
    result = await sendSmtpMessage(mailbox, to, subject, htmlOrText, trackingHeaders, options);
  }

  return {
    success: result.success,
    messageId: result.messageId || '',
    provider: result.provider,
    error: result.error,
    errorDetails: result.errorDetails,
    failureType: result.failureType,
    previewUrl: result.previewUrl,
  };
}

/**
 * Core persistent queue processor tick:
 * 1. Enrolls newly due campaign steps into outbox queue
 * 2. Fetches due outbox jobs
 * 3. Dispatches via real adapters
 * 4. Handles retries with exponential backoff and terminal failure logging
 */
export async function processOutboundSendingBatch(): Promise<{
  processedCount: number;
  failedCount: number;
  errors: string[];
}> {
  // If worker sending is paused or inactive, skip dispatching entirely
  if (!workerSendingActive) {
    return { processedCount: 0, failedCount: 0, errors: [] };
  }

  // Step 1: Enroll active campaign steps based on schedules & delay rules
  enrollAllActiveCampaigns();

  const db = getDatabase();
  const now = new Date();
  const errors: string[] = [];
  let processedCount = 0;
  let failedCount = 0;

  const dueJobs = getDueJobs(now);
  if (dueJobs.length === 0) {
    return { processedCount: 0, failedCount: 0, errors: [] };
  }

  const suppressedEmails = new Set(db.suppressionList.map((s) => s.email.toLowerCase()));

  for (const job of dueJobs) {
    const lead = db.leads.find((l) => l.id === job.leadId || l.email.toLowerCase() === job.leadEmail.toLowerCase());
    const campaign = db.campaigns.find((c) => c.id === job.campaignId);

    // Guard: Check global suppression
    if (suppressedEmails.has(job.leadEmail.toLowerCase()) || (lead && (lead.unsubscribeStatus || lead.bounceStatus))) {
      job.status = 'cancelled';
      job.lastError = 'Lead is suppressed, bounced, or unsubscribed';
      saveDatabase(db);
      continue;
    }

    // Guard: Auto-stop if lead already replied
    if (campaign?.settings.stopOnReply && lead && (lead.status === 'replied' || lead.status === 'interested' || lead.status === 'meeting_booked')) {
      job.status = 'cancelled';
      job.lastError = 'Sequence stopped because recipient already replied';
      saveDatabase(db);
      continue;
    }

    // Mailbox check & load balance rotation if primary mailbox is exhausted or paused
    let mailbox = db.mailboxes.find((m) => m.id === job.mailboxId);
    if (!mailbox || mailbox.status !== 'connected' || mailbox.sentToday >= mailbox.dailyLimit) {
      if (campaign) {
        const { selected } = selectNextMailbox(
          db.mailboxes,
          campaign.settings.mailboxRotation,
          -1,
          campaign.mailboxAccountIds
        );
        if (selected) {
          mailbox = selected;
          job.mailboxId = selected.id;
          job.mailboxEmail = selected.email;
        } else {
          // No mailbox with remaining quota; defer job to next window
          job.status = 'queued';
          job.lastError = 'No available mailboxes with remaining quota; deferred';
          saveDatabase(db);
          continue;
        }
      } else {
        continue;
      }
    }

    if (!mailbox) {
      continue;
    }

    // Atomically mark processing
    markJobProcessing(job.id);

    const plainTextOnly =
      typeof job.plainTextOnly === 'boolean'
        ? job.plainTextOnly
        : Boolean(campaign?.settings?.plainTextOnly);
    const trackOpens =
      typeof job.trackOpens === 'boolean'
        ? job.trackOpens
        : campaign?.settings?.trackOpens !== false;
    const includeComplianceFooter =
      typeof job.includeComplianceFooter === 'boolean'
        ? job.includeComplianceFooter
        : Boolean(campaign?.settings?.includeComplianceFooter);

    if (!job.trackingToken) {
      job.trackingToken = generateTrackingToken();
    }

    const trackingBaseUrl = resolveTrackingBaseUrl(
      db.workspace?.trackingBaseUrl,
      process.env.PUBLIC_APP_URL || process.env.APP_URL
    );
    const trackingPixelUrl =
      trackOpens && !plainTextOnly && trackingBaseUrl
        ? buildOpenTrackingPixelUrl(trackingBaseUrl, job.trackingToken)
        : undefined;

    const composed = composeOutboundEmail({
      body: job.body,
      plainTextOnly,
      trackingPixelUrl,
    });

    // Real email dispatch without automation fingerprint headers (X-OutboundOS-* / X-Mailer)
    const result = await dispatchRealEmail(
      mailbox.id,
      job.leadEmail,
      job.subject,
      composed.htmlBody || composed.textBody,
      undefined,
      {
        textBody: composed.textBody,
        plainTextOnly,
        includeUnsubscribeHeader: includeComplianceFooter,
      }
    );

    if (result.success) {
      // Mark job sent
      markJobSent(job.id, result.messageId, result.previewUrl);

      // Update mailbox quota & stats
      mailbox.sentToday++;
      mailbox.lastSentAt = Date.now();
      mailbox.lastError = undefined;

      // Update campaign stats & variant performance
      if (campaign) {
        campaign.stats.sent++;
        campaign.stats.delivered++;
        if (job.variantId) {
          const step = campaign.steps.find((s) => s.id === job.stepId || s.stepNumber === job.stepNumber);
          if (step?.emailData?.variants) {
            const v = step.emailData.variants.find((v) => v.id === job.variantId);
            if (v) v.sentCount = (v.sentCount || 0) + 1;
          }
        }
      }

      // Update lead state
      if (lead) {
        lead.lastContacted = now.toISOString();
        if (lead.status === 'new') {
          lead.status = 'contacted';
        }
        lead.campaignId = job.campaignId;
      }

      // Record sending event
      db.sendingEvents.push({
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        workspaceId: db.workspace.id,
        campaignId: job.campaignId,
        leadId: job.leadId,
        mailboxId: mailbox.id,
        eventType: 'sent',
        timestamp: now.toISOString(),
        metadata: {
          messageId: result.messageId,
          recipient: job.leadEmail,
          previewUrl: result.previewUrl,
          provider: result.provider,
        },
      });

      // Update or create conversation thread
      let conv = db.conversations.find((c) => c.leadId === job.leadId && c.campaignId === job.campaignId);
      if (!conv) {
        conv = {
          id: `conv-${Date.now()}-${job.leadId}`,
          workspaceId: db.workspace.id,
          leadId: job.leadId,
          leadName: job.leadName || lead?.fullName || job.leadEmail,
          leadEmail: job.leadEmail,
          leadCompany: lead?.company || 'Prospect',
          campaignId: job.campaignId,
          campaignName: job.campaignName || campaign?.name || 'Campaign',
          mailboxId: mailbox.id,
          mailboxEmail: mailbox.email,
          subject: job.subject,
          snippet: job.body.substring(0, 100),
          status: 'read',
          category: 'general',
          lastMessageAt: now.toISOString(),
          messages: [],
        };
        db.conversations.push(conv);
      }

      conv.messages.push({
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sender: mailbox.name,
        senderEmail: mailbox.email,
        recipientEmail: job.leadEmail,
        subject: job.subject,
        body: job.body,
        timestamp: now.toISOString(),
        isInbound: false,
      });

      processedCount++;
    } else {
      // Mark failed with retry backoff or terminal failure report
      failedCount++;
      const { report } = markJobFailed(
        job.id,
        result.error || 'Delivery failed',
        result.errorDetails,
        result.failureType || 'unknown',
        result.provider
      );

      // Track mailbox error
      mailbox.lastError = result.error;
      if (result.failureType === 'auth') {
        mailbox.status = 'error';
      }

      // Handle hard bounces
      if (result.failureType === 'bounce' && lead) {
        lead.bounceStatus = true;
        lead.status = 'bounced';
        if (campaign) campaign.stats.bounced++;
      }

      errors.push(`Failed dispatching to ${job.leadEmail}: ${result.error}`);
    }
  }

  saveDatabase(db);
  return { processedCount, failedCount, errors };
}

/**
 * Reply synchronization engine across all connected mailboxes
 * Connects to IMAP or calls Gmail/Microsoft Graph APIs to retrieve inbound replies
 */
export async function syncAllMailboxReplies(): Promise<{ syncedCount: number; errors: string[] }> {
  const db = getDatabase();
  let syncedCount = 0;
  const errors: string[] = [];

  for (const mailbox of db.mailboxes) {
    if (mailbox.status === 'sync_completed') mailbox.status = 'connected';
    if (mailbox.status !== 'connected') continue;

    try {
      let inboundMsgs: InboundMessage[] = [];

      if (mailbox.provider === 'gmail') {
        inboundMsgs = await syncGmailReplies(mailbox);
      } else if (mailbox.provider === 'outlook') {
        inboundMsgs = await syncMicrosoftReplies(mailbox);
      } else if (mailbox.provider === 'smtp' && mailbox.imapHost) {
        inboundMsgs = await syncImapReplies(mailbox);
      }

      mailbox.lastSyncAt = new Date().toISOString();
      if ((mailbox.status as string) === 'sync_completed') {
        mailbox.status = 'connected';
      }

      for (const msg of inboundMsgs) {
        const lead = db.leads.find((l) => l.email.toLowerCase() === msg.senderEmail.toLowerCase());
        if (!lead) continue;

        // Check if message already exists in conversation
        let conv = db.conversations.find((c) => c.leadId === lead.id);
        const alreadyExists = conv?.messages.some(
          (m) => m.isInbound && m.timestamp === msg.timestamp && m.subject === msg.subject
        );

        if (alreadyExists) continue;

        // Mark lead as replied
        lead.status = 'replied';
        lead.lastReply = msg.timestamp;

        // Update campaign stats & variant performance
        const leadCampaign = db.campaigns.find((c) => c.id === lead.campaignId);
        if (leadCampaign) {
          leadCampaign.stats.replied++;
          // Find the last sent job for this lead to record variant reply
          const lastSentJob = db.sendingJobs
            .filter((j) => j.leadId === lead.id && j.campaignId === leadCampaign.id && j.status === 'sent')
            .sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime())[0];

          if (lastSentJob?.variantId) {
            for (const step of leadCampaign.steps) {
              const v = step.emailData?.variants?.find((vr) => vr.id === lastSentJob.variantId);
              if (v) {
                v.replyCount = (v.replyCount || 0) + 1;
                break;
              }
            }
          }
        }

        // Auto-pause future sequence steps if stopOnReply is active and no explicit reply branch exists
        const hasExplicitReplyBranch = leadCampaign?.steps.some(
          (s) => s.type === 'condition' && s.conditionType === 'if_replied' && s.yesStepNumber
        );

        if (leadCampaign?.settings.stopOnReply !== false && !hasExplicitReplyBranch) {
          const pendingJobs = db.sendingJobs.filter(
            (j) => j.leadId === lead.id && (j.status === 'queued' || j.status === 'retrying' || j.status === 'scheduled')
          );
          for (const pj of pendingJobs) {
            pj.status = 'cancelled';
            pj.lastError = 'Cancelled due to recipient inbound reply';
          }
        }

        if (!conv) {
          conv = {
            id: `conv-inbound-${Date.now()}-${lead.id}`,
            workspaceId: db.workspace.id,
            leadId: lead.id,
            leadName: lead.fullName || `${lead.firstName} ${lead.lastName}`,
            leadEmail: lead.email,
            leadCompany: lead.company,
            campaignId: lead.campaignId || 'camp-default',
            campaignName: 'Direct Outreach',
            mailboxId: mailbox.id,
            mailboxEmail: mailbox.email,
            subject: msg.subject,
            snippet: msg.body.substring(0, 100),
            status: 'unread',
            category: 'general',
            lastMessageAt: msg.timestamp,
            messages: [],
          };
          db.conversations.unshift(conv);
        } else {
          conv.status = 'unread';
          conv.lastMessageAt = msg.timestamp;
          conv.snippet = msg.body.substring(0, 100);
        }

        conv.messages.push(msg);
        syncedCount++;

        db.auditLogs.unshift({
          id: `log-${Date.now()}`,
          action: 'INBOUND_REPLY_SYNCED',
          details: `Synced reply from ${lead.email} via ${mailbox.provider} (${mailbox.email}). Sequence auto-stopped.`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      errors.push(`Error syncing ${mailbox.email}: ${err.message}`);
    }
  }

  if (syncedCount > 0 || db.mailboxes.some((m) => m.status === 'reauth_required' || m.status === 'temporary_error')) {
    saveDatabase(db);
  }

  return { syncedCount, errors };
}

/**
 * Worker sending state controls
 * Default: false unless AUTO_START_WORKER=true is set in environment.
 * Prevents unintentional automatic sending on fresh boot.
 */
let workerSendingActive = process.env.AUTO_START_WORKER === 'true';

export function isWorkerSendingActive(): boolean {
  return workerSendingActive;
}

export function setWorkerSendingActive(active: boolean): void {
  workerSendingActive = active;
  console.log(`[OutboundOS Worker] Worker sending dispatch updated: active = ${active}`);
}

/**
 * Global Emergency Kill Switch
 * 1. Disables worker sending
 * 2. Pauses all active & scheduled campaigns
 * 3. Cancels all pending queued/retrying sending jobs
 */
export function activateKillSwitch(): { pausedCampaigns: number; cancelledJobs: number } {
  workerSendingActive = false;
  const db = getDatabase();

  let pausedCampaigns = 0;
  for (const c of db.campaigns) {
    if (c.status === 'active' || c.status === 'scheduled') {
      c.status = 'paused';
      pausedCampaigns++;
    }
  }

  let cancelledJobs = 0;
  for (const j of db.sendingJobs) {
    if (j.status === 'queued' || j.status === 'retrying' || j.status === 'scheduled' || j.status === 'processing') {
      j.status = 'cancelled';
      j.lastError = 'Cancelled via Global Sending Kill Switch';
      cancelledJobs++;
    }
  }

  saveDatabase(db);
  console.log(`[KillSwitch] Emergency stop activated: ${pausedCampaigns} campaigns paused, ${cancelledJobs} jobs cancelled.`);
  return { pausedCampaigns, cancelledJobs };
}

/**
 * Pauses all active campaigns without cancelling queued jobs
 */
export function pauseAllCampaigns(): number {
  const db = getDatabase();
  let pausedCount = 0;
  for (const c of db.campaigns) {
    if (c.status === 'active' || c.status === 'scheduled') {
      c.status = 'paused';
      pausedCount++;
    }
  }
  saveDatabase(db);
  return pausedCount;
}

/**
 * Clears or cancels all pending jobs in the queue
 */
export function clearPendingQueue(): number {
  const db = getDatabase();
  let clearedCount = 0;
  for (const j of db.sendingJobs) {
    if (j.status === 'queued' || j.status === 'retrying' || j.status === 'scheduled') {
      j.status = 'cancelled';
      j.lastError = 'Cleared by operator from queue management';
      clearedCount++;
    }
  }
  saveDatabase(db);
  return clearedCount;
}

/**
 * Background persistent worker timer running inside Node.js
 * Ensures campaigns execute and reply sync runs when the browser is closed.
 */
let workerInterval: NodeJS.Timeout | null = null;
let replySyncInterval: NodeJS.Timeout | null = null;
let isWorkerTicking = false;

export function startAutonomousBackgroundWorker(): void {
  if (workerInterval) return;

  console.log(`[OutboundOS Worker] Starting persistent background engine (sendingActive: ${workerSendingActive})...`);

  // Queue dispatch loop: every 15 seconds
  workerInterval = setInterval(async () => {
    if (isWorkerTicking || !workerSendingActive) return;
    isWorkerTicking = true;
    try {
      await processOutboundSendingBatch();
    } catch (e: any) {
      console.error('[OutboundOS Worker] Queue cycle error:', e.message);
    } finally {
      isWorkerTicking = false;
    }
  }, 15000);

  // Reply sync loop: every 60 seconds (always runs to safely detect inbound replies)
  replySyncInterval = setInterval(async () => {
    try {
      await syncAllMailboxReplies();
    } catch (e: any) {
      console.error('[OutboundOS Worker] Reply sync cycle error:', e.message);
    }
  }, 60000);
}

export function stopAutonomousBackgroundWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  if (replySyncInterval) {
    clearInterval(replySyncInterval);
    replySyncInterval = null;
  }
}

/**
 * Testing simulation helper for manual reply injection
 */
export function simulateInboundReply(
  leadEmail: string,
  replyBody: string,
  sentiment: 'interested' | 'not_interested' | 'out_of_office' | 'question' = 'interested'
): { success: boolean; conversation?: any; error?: string } {
  const db = getDatabase();
  const lead = db.leads.find((l) => l.email.toLowerCase() === leadEmail.toLowerCase());
  if (!lead) {
    return { success: false, error: 'Lead with this email does not exist' };
  }

  const now = new Date().toISOString();
  lead.status = sentiment === 'interested' ? 'interested' : 'replied';
  lead.lastReply = now;

  // Update campaign stats & variant performance
  const leadCampaign = db.campaigns.find((c) => c.id === lead.campaignId);
  if (leadCampaign) {
    leadCampaign.stats.replied++;
    if (sentiment === 'interested') {
      leadCampaign.stats.positiveReplies++;
    }
    const lastSentJob = db.sendingJobs
      .filter((j) => j.leadId === lead.id && j.campaignId === leadCampaign.id && j.status === 'sent')
      .sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime())[0];

    if (lastSentJob?.variantId) {
      for (const step of leadCampaign.steps) {
        const v = step.emailData?.variants?.find((vr) => vr.id === lastSentJob.variantId);
        if (v) {
          v.replyCount = (v.replyCount || 0) + 1;
          break;
        }
      }
    }
  }

  // Auto-pause future sequence steps if stopOnReply is active and no explicit reply branch exists
  const hasExplicitReplyBranch = leadCampaign?.steps.some(
    (s) => s.type === 'condition' && s.conditionType === 'if_replied' && s.yesStepNumber
  );

  if (leadCampaign?.settings.stopOnReply !== false && !hasExplicitReplyBranch) {
    const pendingJobs = db.sendingJobs.filter(
      (j) => j.leadId === lead.id && (j.status === 'queued' || j.status === 'retrying' || j.status === 'scheduled')
    );
    for (const pj of pendingJobs) {
      pj.status = 'cancelled';
      pj.lastError = 'Cancelled due to recipient inbound reply';
    }
  }

  // Find or create conversation
  let conv = db.conversations.find((c) => c.leadId === lead.id);
  if (!conv) {
    conv = {
      id: `conv-reply-${Date.now()}`,
      workspaceId: db.workspace.id,
      leadId: lead.id,
      leadName: lead.fullName || `${lead.firstName} ${lead.lastName}`,
      leadEmail: lead.email,
      leadCompany: lead.company,
      campaignId: lead.campaignId || 'camp-q4-enterprise',
      campaignName: 'Direct Outreach',
      mailboxId: db.mailboxes[0]?.id || 'mb-primary-google',
      mailboxEmail: db.mailboxes[0]?.email || 'outreach@apexoutbound.io',
      subject: `Re: Conversation with ${lead.firstName}`,
      snippet: replyBody.substring(0, 100),
      status: 'unread',
      category: sentiment,
      lastMessageAt: now,
      messages: [],
    };
    db.conversations.unshift(conv);
  } else {
    conv.status = 'unread';
    conv.category = sentiment;
    conv.snippet = replyBody.substring(0, 100);
    conv.lastMessageAt = now;
  }

  conv.messages.push({
    id: `msg-inbound-${Date.now()}`,
    sender: lead.fullName || lead.firstName,
    senderEmail: lead.email,
    recipientEmail: conv.mailboxEmail,
    subject: conv.subject,
    body: replyBody,
    timestamp: now,
    isInbound: true,
  });

  // Execute matching automations
  for (const auto of db.automations) {
    if (!auto.enabled) continue;
    if (auto.triggerEvent === 'reply_received' || (auto.triggerEvent === 'positive_reply' && sentiment === 'interested')) {
      auto.executionCount++;
      auto.lastExecutedAt = now;

      if (auto.actionType === 'move_deal_stage') {
        const targetStage = auto.actionParams.targetStage || 'interested';
        let deal = db.deals.find((d) => d.leadId === lead.id);
        if (deal) {
          deal.stage = targetStage;
          deal.updatedAt = now;
        } else {
          db.deals.push({
            id: `deal-${Date.now()}`,
            workspaceId: db.workspace.id,
            leadId: lead.id,
            leadName: lead.fullName,
            leadEmail: lead.email,
            leadCompany: lead.company,
            title: `${lead.company} — Outreach Opportunity`,
            value: 25000,
            stage: targetStage,
            owner: 'Azeem Khawer',
            notes: `Auto-created from positive reply: "${replyBody.substring(0, 80)}..."`,
            createdAt: now,
            updatedAt: now,
          });
        }
      } else if (auto.actionType === 'add_tag') {
        const tag = auto.actionParams.tag || 'Warm Lead';
        if (!lead.tags.includes(tag)) lead.tags.push(tag);
      }
    }
  }

  db.auditLogs.unshift({
    id: `log-${Date.now()}`,
    action: 'INBOUND_REPLY_DETECTED',
    details: `Detected inbound response from ${lead.email} (${sentiment}). Sequence automatically paused.`,
    timestamp: now,
  });

  saveDatabase(db);
  return { success: true, conversation: conv };
}

export function handleUnsubscribe(email: string): { success: boolean } {
  const db = getDatabase();
  const trimmed = email.trim().toLowerCase();

  if (!db.suppressionList.some((s) => s.email.toLowerCase() === trimmed)) {
    db.suppressionList.push({
      email: trimmed,
      reason: 'Recipient requested unsubscribe',
      addedAt: new Date().toISOString(),
    });
  }

  for (const lead of db.leads) {
    if (lead.email.toLowerCase() === trimmed) {
      lead.unsubscribeStatus = true;
      lead.status = 'unsubscribed';
    }
  }

  // Cancel any pending sending jobs
  for (const job of db.sendingJobs) {
    if (job.leadEmail.toLowerCase() === trimmed && (job.status === 'queued' || job.status === 'retrying')) {
      job.status = 'cancelled';
      job.lastError = 'Cancelled due to unsubscribe';
    }
  }

  for (const auto of db.automations) {
    if (!auto.enabled || auto.triggerEvent !== 'unsubscribed') continue;
    auto.executionCount++;
    auto.lastExecutedAt = new Date().toISOString();
  }

  db.workspace.globalSuppressionCount = db.suppressionList.length;
  db.auditLogs.unshift({
    id: `log-${Date.now()}`,
    action: 'LEAD_UNSUBSCRIBED',
    details: `${trimmed} suppressed globally across all current and future campaigns`,
    timestamp: new Date().toISOString(),
  });

  saveDatabase(db);
  return { success: true };
}
