import { getDatabase, saveDatabase } from './db';
import { Campaign, CampaignSchedule, Lead, CampaignStep, SendingJob, EmailVariant } from '../types';
import { enqueueJob } from './queue';
import { interpolateTemplate } from '../utils/templateEngine';
import { selectNextMailbox } from '../utils/senderRotation';

/**
 * Checks if current time is within the campaign's active sending schedule window
 */
export function isWithinScheduleWindow(schedule: CampaignSchedule, date = new Date()): boolean {
  if (!schedule) return true;

  // Check date range if specified
  if (schedule.startDate && new Date(schedule.startDate) > date) {
    return false;
  }
  if (schedule.endDate && new Date(schedule.endDate) < date) {
    return false;
  }

  // Check day of week: JavaScript getDay() returns 0=Sun, 1=Mon, ..., 6=Sat
  // Campaign schedule format: 1=Mon, 2=Tue, ..., 7=Sun
  const jsDay = date.getDay();
  const campaignDay = jsDay === 0 ? 7 : jsDay;

  if (schedule.sendingDays && schedule.sendingDays.length > 0) {
    if (!schedule.sendingDays.includes(campaignDay)) {
      return false;
    }
  }

  // Check hours window (e.g. "09:00" to "17:00")
  if (schedule.startTime && schedule.endTime) {
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);

    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 24) * 60 + (endM || 0);

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluates the next step in a campaign's sequence graph for a specific lead.
 * Supports:
 * - Linear sequences and delay steps
 * - Conditional branches (if_replied, if_opened, if_clicked)
 * - Automatic termination on replies, bounces, and unsubscribes
 * - A/B testing variants with weighted selection
 */
export function resolveNextSequenceStep(
  campaign: Campaign,
  lead: Lead,
  leadJobs: SendingJob[],
  now = new Date()
): { nextStep: CampaignStep | null; scheduledAt: string; chosenVariant?: EmailVariant } {
  const db = getDatabase();

  // Termination checks: bounce, unsubscribe, or global suppression
  const suppressedEmails = new Set(db.suppressionList.map((s) => s.email.toLowerCase()));
  if (lead.unsubscribeStatus || lead.bounceStatus || suppressedEmails.has(lead.email.toLowerCase())) {
    return { nextStep: null, scheduledAt: now.toISOString() };
  }

  // Check if lead has already replied
  const hasReplied = Boolean(
    lead.status === 'replied' ||
    lead.status === 'interested' ||
    lead.status === 'meeting_booked' ||
    lead.lastReply ||
    db.conversations.some((c) => c.leadId === lead.id && c.messages.some((m) => m.isInbound))
  );

  // If campaign stops on reply and lead has replied, check if any remaining step is an explicit positive condition branch
  if (campaign.settings.stopOnReply && hasReplied) {
    // Only continue if the campaign explicitly has a condition step routing replies
    const hasReplyBranch = campaign.steps.some(
      (s) => s.type === 'condition' && s.conditionType === 'if_replied' && s.yesStepNumber
    );
    if (!hasReplyBranch) {
      return { nextStep: null, scheduledAt: now.toISOString() };
    }
  }

  const sentJobs = leadJobs
    .filter((j) => j.status === 'sent')
    .sort((a, b) => new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime());
  const sentStepNumbers = new Set(sentJobs.map((j) => j.stepNumber));

  // Map steps by stepNumber for direct lookup
  const stepMap = new Map<number, CampaignStep>();
  campaign.steps.forEach((s) => stepMap.set(s.stepNumber, s));

  const sortedSteps = [...campaign.steps].sort((a, b) => a.stepNumber - b.stepNumber);
  if (sortedSteps.length === 0) {
    return { nextStep: null, scheduledAt: now.toISOString() };
  }

  // Determine starting pointer
  let currentStepNumber = sortedSteps[0].stepNumber;
  let lastSentJob: SendingJob | undefined = undefined;

  if (sentJobs.length > 0) {
    lastSentJob = sentJobs[sentJobs.length - 1];
    // Start evaluating immediately after the last sent step
    currentStepNumber = lastSentJob.stepNumber + 1;
  }

  let accumulatedDelayHours = 0;
  let scheduledAt = now.toISOString();
  let visitedSteps = new Set<number>();
  let iterationCount = 0;

  while (currentStepNumber && iterationCount < 50) {
    iterationCount++;
    if (visitedSteps.has(currentStepNumber)) {
      break; // Prevent infinite cycle
    }
    visitedSteps.add(currentStepNumber);

    const step = stepMap.get(currentStepNumber);
    if (!step) {
      // Step number out of bounds or sequence completed
      break;
    }

    if (step.type === 'delay') {
      accumulatedDelayHours += step.delayHours || 24;
      currentStepNumber = step.stepNumber + 1;
      continue;
    }

    if (step.type === 'condition') {
      let conditionMet = false;

      if (step.conditionType === 'if_replied') {
        conditionMet = hasReplied;
      } else if (step.conditionType === 'if_opened') {
        conditionMet = db.sendingEvents.some(
          (e) => e.leadId === lead.id && e.campaignId === campaign.id && e.eventType === 'opened'
        );
      } else if (step.conditionType === 'if_clicked') {
        conditionMet = db.sendingEvents.some(
          (e) => e.leadId === lead.id && e.campaignId === campaign.id && e.eventType === 'clicked'
        );
      }

      const targetStepNumber = conditionMet
        ? step.yesStepNumber || step.stepNumber + 1
        : step.noStepNumber || step.stepNumber + 1;

      currentStepNumber = targetStepNumber;
      continue;
    }

    if (step.type === 'email' && step.emailData) {
      // If this email step was already sent, skip to next step
      if (sentStepNumbers.has(step.stepNumber)) {
        currentStepNumber = step.stepNumber + 1;
        continue;
      }

      // Calculate scheduled time based on accumulated delay from last sent job
      if (lastSentJob && lastSentJob.sentAt && accumulatedDelayHours > 0) {
        const eligibleSendTime = new Date(
          new Date(lastSentJob.sentAt).getTime() + accumulatedDelayHours * 3600000
        );
        scheduledAt = eligibleSendTime.toISOString();
      }

      // Select A/B testing variant if present
      let chosenVariant: EmailVariant | undefined = undefined;
      if (step.emailData.variants && step.emailData.variants.length > 0) {
        const variants = step.emailData.variants;
        const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0) || 100;
        let rand = Math.random() * totalWeight;
        for (const v of variants) {
          if (rand <= (v.weight || 0)) {
            chosenVariant = v;
            break;
          }
          rand -= v.weight || 0;
        }
        if (!chosenVariant) chosenVariant = variants[0];
      }

      return {
        nextStep: step,
        scheduledAt,
        chosenVariant,
      };
    }

    // Default advancement
    currentStepNumber = step.stepNumber + 1;
  }

  return { nextStep: null, scheduledAt: now.toISOString() };
}

/**
 * Enrolls eligible leads for a campaign into the durable sending queue
 */
export function enrollCampaignLeadsIntoQueue(campaign: Campaign, now = new Date(), ignoreScheduleWindow = false): number {
  const db = getDatabase();

  // If outside schedule window and not forced, don't enqueue now
  if (!ignoreScheduleWindow && !isWithinScheduleWindow(campaign.schedule, now)) {
    return 0;
  }

  // Check campaign daily limits
  if (campaign.stats.sent >= campaign.settings.dailyLimit) {
    return 0;
  }

  const suppressedEmails = new Set(db.suppressionList.map((s) => s.email.toLowerCase()));
  const candidateLeads = db.leads.filter((l) => {
    if (l.listId !== campaign.leadListId && l.campaignId !== campaign.id) return false;
    if (l.unsubscribeStatus || l.bounceStatus) return false;
    if (suppressedEmails.has(l.email.toLowerCase())) return false;
    if (campaign.settings.stopOnReply && (l.status === 'replied' || l.status === 'interested' || l.status === 'meeting_booked')) {
      const hasExplicitReplyBranch = campaign.steps.some(
        (s) => s.type === 'condition' && s.conditionType === 'if_replied' && s.yesStepNumber
      );
      if (!hasExplicitReplyBranch) return false;
    }
    return true;
  });

  if (candidateLeads.length === 0) return 0;

  let enqueuedCount = 0;

  for (const lead of candidateLeads) {
    // Check if lead already has an in-flight job
    const leadJobs = db.sendingJobs.filter((j) => j.campaignId === campaign.id && j.leadId === lead.id);
    const hasActiveJob = leadJobs.some((j) => ['queued', 'scheduled', 'processing', 'retrying'].includes(j.status));
    if (hasActiveJob) continue;

    // Resolve next step in sequence flow
    const { nextStep, scheduledAt, chosenVariant } = resolveNextSequenceStep(campaign, lead, leadJobs, now);
    if (!nextStep || !nextStep.emailData) continue;

    // Pick mailbox using rotation engine
    const { selected: mailbox } = selectNextMailbox(
      db.mailboxes,
      campaign.settings.mailboxRotation,
      -1,
      campaign.mailboxAccountIds
    );

    if (!mailbox) {
      break; // No mailboxes with remaining quota
    }

    // Determine subject & body from variant or main emailData
    const rawSubject = chosenVariant?.subject || nextStep.emailData.subject;
    const rawBody = chosenVariant?.body || nextStep.emailData.body;

    // Personalize with template engine (including fallbacks)
    const personalizedSubject = interpolateTemplate(rawSubject, lead);
    const personalizedBody = interpolateTemplate(rawBody, lead);

    // Append signature, physical compliance address, and unsubscribe footer
    const fullBody = `${personalizedBody}\n\n--\n${mailbox.signature || ''}\n\n${db.workspace.physicalAddress}\n${db.workspace.unsubscribeFooter}`;

    const { isDuplicate } = enqueueJob({
      workspaceId: db.workspace.id,
      campaignId: campaign.id,
      campaignName: campaign.name,
      leadId: lead.id,
      leadEmail: lead.email,
      leadName: lead.fullName || `${lead.firstName} ${lead.lastName}`.trim(),
      mailboxId: mailbox.id,
      mailboxEmail: mailbox.email,
      stepId: nextStep.id,
      stepNumber: nextStep.stepNumber,
      variantId: chosenVariant?.id,
      variantName: chosenVariant?.name,
      subject: personalizedSubject,
      body: fullBody,
      scheduledAt,
      maxAttempts: 3,
    });

    if (!isDuplicate) {
      enqueuedCount++;
    }
  }

  return enqueuedCount;
}

/**
 * Enrolls all active campaigns into the durable queue
 */
export function enrollAllActiveCampaigns(): number {
  const db = getDatabase();
  const activeCampaigns = db.campaigns.filter((c) => c.status === 'active');
  let totalEnqueued = 0;

  for (const campaign of activeCampaigns) {
    totalEnqueued += enrollCampaignLeadsIntoQueue(campaign);
  }

  return totalEnqueued;
}
