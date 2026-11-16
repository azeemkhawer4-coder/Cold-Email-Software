import {
  Campaign,
  Company,
  Conversation,
  Deal,
  Lead,
  LeadList,
  MailboxAccount,
  SendingJob,
} from '../types';

export interface DailySeriesPoint {
  dateKey: string;
  label: string;
  sent: number;
  delivered: number;
  opened: number;
  replied: number;
  positive: number;
  bounced: number;
}

export interface VariantPerformanceRow {
  campaignId: string;
  campaignName: string;
  stepNumber: number;
  variantId: string;
  name: string;
  subject: string;
  sentCount: number;
  openCount: number;
  openRate: number;
  replyCount: number;
  replyRate: number;
}

export interface AnalyticsSummary {
  totalLeads: number;
  verifiedLeads: number;
  activeCampaignsCount: number;
  connectedProductionMailboxesCount: number;
  reauthRequiredMailboxesCount: number;
  testMailboxesCount: number;
  totalDailyProductionCapacity: number;
  totalSentTodayProduction: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalReplies: number;
  positiveReplies: number;
  totalMeetings: number;
  totalBounced: number;
  totalUnsubscribed: number;
  openRate: number;
  replyRate: number;
  positiveReplyRate: number;
  bounceRate: number;
  openPipelineValue: number;
  openDealsCount: number;
  dailySeries: DailySeriesPoint[];
  variantResults: VariantPerformanceRow[];
  topOpportunities: Deal[];
}

export function isProductionMailboxConnected(mailbox: MailboxAccount): boolean {
  return mailbox.status === 'connected' && !mailbox.isTestMailbox;
}

export function isLeadIncomplete(lead: Pick<Lead, 'firstName' | 'company' | 'jobTitle'>): boolean {
  return !lead.firstName?.trim() || !lead.company?.trim() || !lead.jobTitle?.trim();
}

export function computeAnalyticsSummary(input: {
  leads: Lead[];
  campaigns: Campaign[];
  mailboxes: MailboxAccount[];
  conversations: Conversation[];
  sendingJobs: SendingJob[];
  deals: Deal[];
}): AnalyticsSummary {
  const { leads, campaigns, mailboxes, conversations, sendingJobs, deals } = input;

  const totalLeads = leads.length;
  const verifiedLeads = leads.filter((l) => l.verificationStatus === 'valid').length;
  const activeCampaignsCount = campaigns.filter((c) => c.status === 'active').length;

  const connectedProdMailboxes = mailboxes.filter(isProductionMailboxConnected);
  const reauthRequiredMailboxes = mailboxes.filter(
    (m) => m.status === 'reauth_required' || m.status === 'error'
  );
  const testMailboxes = mailboxes.filter((m) => Boolean(m.isTestMailbox));

  const totalDailyProductionCapacity = connectedProdMailboxes.reduce(
    (acc, m) => acc + (m.dailyLimit || m.dailyQuota || 0),
    0
  );
  const totalSentTodayProduction = connectedProdMailboxes.reduce(
    (acc, m) => acc + (m.sentToday || 0),
    0
  );

  // Aggregate campaign stats cleanly and reconcile with real jobs / conversations
  const campSent = campaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0);
  const campDelivered = campaigns.reduce((acc, c) => acc + (c.stats?.delivered || 0), 0);
  const campOpened = campaigns.reduce((acc, c) => acc + (c.stats?.opened || 0), 0);
  const campReplied = campaigns.reduce((acc, c) => acc + (c.stats?.replied || 0), 0);
  const campPositive = campaigns.reduce((acc, c) => acc + (c.stats?.positiveReplies || 0), 0);
  const campMeetings = campaigns.reduce((acc, c) => acc + (c.stats?.meetingsBooked || 0), 0);
  const campBounced = campaigns.reduce((acc, c) => acc + (c.stats?.bounced || 0), 0);
  const campUnsub = campaigns.reduce((acc, c) => acc + (c.stats?.unsubscribed || 0), 0);

  const sentJobs = sendingJobs.filter((j) => j.status === 'sent');
  const openedJobs = sentJobs.filter((j) => Boolean(j.openedAt || (j.openCount && j.openCount > 0)));
  const bouncedJobs = sendingJobs.filter((j) => j.status === 'bounced');
  const inboundConversations = conversations.filter((c) =>
    c.messages.some((m) => m.isInbound)
  );
  const positiveConversations = conversations.filter(
    (c) => c.category === 'interested' || c.category === 'meeting_booked'
  );
  const meetingConversations = conversations.filter((c) => c.category === 'meeting_booked');
  const openDeals = deals.filter((d) => d.stage !== 'lost');

  const totalSent = Math.max(campSent, sentJobs.length);
  const totalDelivered = Math.max(campDelivered, sentJobs.length);
  const totalOpened = Math.min(totalSent, Math.max(campOpened, openedJobs.length));
  const totalReplies = Math.max(campReplied, inboundConversations.length);
  const positiveReplies = Math.max(campPositive, positiveConversations.length);
  const totalMeetings = Math.max(campMeetings, meetingConversations.length);
  const totalBounced = Math.max(campBounced, bouncedJobs.length);
  const totalUnsubscribed = campUnsub;

  const openRate = totalSent > 0 ? Number(((totalOpened / totalSent) * 100).toFixed(1)) : 0;
  const replyRate = totalSent > 0 ? Number(((totalReplies / totalSent) * 100).toFixed(1)) : 0;
  const positiveReplyRate = totalSent > 0 ? Number(((positiveReplies / totalSent) * 100).toFixed(1)) : 0;
  const bounceRate = totalSent > 0 ? Number(((totalBounced / totalSent) * 100).toFixed(1)) : 0;

  const openPipelineValue = openDeals.reduce((acc, d) => acc + (d.value || 0), 0);

  // Build real last-7-days daily series from sendingJobs & inbound conversations
  const dayBuckets = new Map<string, DailySeriesPoint>();
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    dayBuckets.set(key, {
      dateKey: key,
      label,
      sent: 0,
      delivered: 0,
      opened: 0,
      replied: 0,
      positive: 0,
      bounced: 0,
    });
  }

  for (const job of sendingJobs) {
    const ts = job.sentAt || job.updatedAt || job.createdAt;
    if (!ts) continue;
    const key = ts.split('T')[0];
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;
    if (job.status === 'sent') {
      bucket.sent++;
      bucket.delivered++;
      if (job.openedAt) {
        const openKey = job.openedAt.split('T')[0];
        const openBucket = dayBuckets.get(openKey);
        if (openBucket) openBucket.opened++;
      }
    } else if (job.status === 'bounced') {
      bucket.bounced++;
    }
  }

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (!msg.isInbound || !msg.timestamp) continue;
      const key = msg.timestamp.split('T')[0];
      const bucket = dayBuckets.get(key);
      if (bucket) {
        bucket.replied++;
        if (conv.category === 'interested' || conv.category === 'meeting_booked') {
          bucket.positive++;
        }
      }
    }
  }

  // Real A/B variant performance
  const variantResults: VariantPerformanceRow[] = [];
  for (const camp of campaigns) {
    for (const step of camp.steps || []) {
      if (step.type !== 'email' || !step.emailData?.variants?.length) continue;
      for (let i = 0; i < step.emailData.variants.length; i++) {
        const v = step.emailData.variants[i];
        const jobsForVariant = sentJobs.filter(
          (j) => j.campaignId === camp.id && j.variantId === v.id
        );
        const sentCount = Math.max(v.sentCount || 0, jobsForVariant.length);
        const openedJobsForVariant = jobsForVariant.filter(
          (j) => Boolean(j.openedAt || (j.openCount && j.openCount > 0))
        ).length;
        const openCount = Math.min(sentCount, Math.max(v.openCount || 0, openedJobsForVariant));
        const replyCount = v.replyCount || 0;
        variantResults.push({
          campaignId: camp.id,
          campaignName: camp.name,
          stepNumber: step.stepNumber,
          variantId: v.id,
          name: v.name || `Variant ${String.fromCharCode(65 + i)}`,
          subject: v.subject || step.emailData.subject,
          sentCount,
          openCount,
          openRate: sentCount > 0 ? Number(((openCount / sentCount) * 100).toFixed(1)) : 0,
          replyCount,
          replyRate: sentCount > 0 ? Number(((replyCount / sentCount) * 100).toFixed(1)) : 0,
        });
      }
    }
  }

  const topOpportunities = [...openDeals]
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 5);

  return {
    totalLeads,
    verifiedLeads,
    activeCampaignsCount,
    connectedProductionMailboxesCount: connectedProdMailboxes.length,
    reauthRequiredMailboxesCount: reauthRequiredMailboxes.length,
    testMailboxesCount: testMailboxes.length,
    totalDailyProductionCapacity,
    totalSentTodayProduction,
    totalSent,
    totalDelivered,
    totalOpened,
    totalReplies,
    positiveReplies,
    totalMeetings,
    totalBounced,
    totalUnsubscribed,
    openRate,
    replyRate,
    positiveReplyRate,
    bounceRate,
    openPipelineValue,
    openDealsCount: openDeals.length,
    dailySeries: Array.from(dayBuckets.values()),
    variantResults,
    topOpportunities,
  };
}

/**
 * Dynamically reconciles list counts directly from the leads collection
 */
export function reconcileLeadLists(lists: LeadList[], leads: Lead[]): LeadList[] {
  return lists.map((list) => {
    const members = leads.filter((l) => l.listId === list.id);
    const verifiedCount = members.filter((l) => l.verificationStatus === 'valid').length;
    return {
      ...list,
      leadCount: members.length,
      verifiedCount,
    };
  });
}

/**
 * Dynamically reconciles company lead counts, active deal counts, and total open pipeline value
 */
export function reconcileCompanies(
  companies: Company[],
  leads: Lead[],
  deals: Deal[]
): Company[] {
  return companies.map((company) => {
    const compNameLower = (company.name || '').trim().toLowerCase();
    const compDomainLower = (company.domain || '').trim().toLowerCase();

    const matchedLeads = leads.filter((l) => {
      const leadCompLower = (l.company || '').trim().toLowerCase();
      const leadDomainLower = (l.domain || '').trim().toLowerCase();
      return (
        (compNameLower && leadCompLower === compNameLower) ||
        (compDomainLower && leadDomainLower === compDomainLower)
      );
    });
    const matchedLeadIds = new Set(matchedLeads.map((l) => l.id));

    const matchedDeals = deals.filter((d) => {
      if (d.stage === 'lost') return false;
      const dealCompLower = (d.leadCompany || '').trim().toLowerCase();
      return (
        (d.leadId && matchedLeadIds.has(d.leadId)) ||
        (compNameLower && dealCompLower === compNameLower)
      );
    });

    const totalValue = matchedDeals.reduce((sum, d) => sum + (d.value || 0), 0);

    return {
      ...company,
      leadsCount: matchedLeads.length,
      leadCount: matchedLeads.length,
      dealsCount: matchedDeals.length,
      totalValue,
    };
  });
}
