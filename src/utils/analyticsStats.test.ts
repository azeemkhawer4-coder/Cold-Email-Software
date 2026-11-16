import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAnalyticsSummary,
  reconcileLeadLists,
  reconcileCompanies,
  isProductionMailboxConnected,
  isLeadIncomplete,
} from './analyticsStats';
import { selectNextMailbox } from './senderRotation';
import { Campaign, Company, Conversation, Deal, Lead, LeadList, MailboxAccount, SendingJob } from '../types';

const makeLead = (overrides: Partial<Lead> = {}): Lead => ({
  id: 'lead-1',
  workspaceId: 'ws-1',
  firstName: 'Dana',
  lastName: 'Scully',
  fullName: 'Dana Scully',
  email: 'dana@acme.com',
  jobTitle: 'VP Ops',
  company: 'Acme Inc',
  website: 'acme.com',
  domain: 'acme.com',
  industry: 'SaaS',
  country: 'US',
  city: 'Austin',
  linkedinUrl: '',
  phone: '',
  source: 'CSV',
  verificationStatus: 'valid',
  status: 'new',
  assignedOwner: 'Owner',
  customFields: {},
  notes: '',
  tags: [],
  dateAdded: '2026-11-14T10:00:00.000Z',
  unsubscribeStatus: false,
  bounceStatus: false,
  listId: 'list-1',
  ...overrides,
});

const makeMailbox = (overrides: Partial<MailboxAccount> = {}): MailboxAccount => ({
  id: 'mb-1',
  workspaceId: 'ws-1',
  email: 'sender@acme.com',
  name: 'Sender',
  provider: 'gmail',
  status: 'connected',
  dailyLimit: 50,
  sentToday: 5,
  warmupStatus: 'active',
  warmupScore: 95,
  healthScore: 95,
  signature: '',
  lastSyncAt: '2026-11-14T10:00:00.000Z',
  createdAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
});

test('isProductionMailboxConnected excludes test mailboxes and disconnected/reauth_required accounts', () => {
  assert.equal(isProductionMailboxConnected(makeMailbox({ status: 'connected', isTestMailbox: false })), true);
  assert.equal(isProductionMailboxConnected(makeMailbox({ status: 'connected', isTestMailbox: true })), false);
  assert.equal(isProductionMailboxConnected(makeMailbox({ status: 'reauth_required', isTestMailbox: false })), false);
  assert.equal(isProductionMailboxConnected(makeMailbox({ status: 'disconnected', isTestMailbox: false })), false);
});

test('selectNextMailbox skips test mailboxes when no explicit IDs are passed and honors explicit assignment', () => {
  const testRig = makeMailbox({ id: 'mb-test', email: 'rig@ethereal.email', isTestMailbox: true, sentToday: 0 });
  const prod = makeMailbox({ id: 'mb-prod', email: 'real@acme.com', isTestMailbox: false, sentToday: 10 });

  const autoPick = selectNextMailbox([testRig, prod], 'balanced', -1);
  assert.equal(autoPick.selected?.id, 'mb-prod');

  const explicitPick = selectNextMailbox([testRig, prod], 'balanced', -1, ['mb-test']);
  assert.equal(explicitPick.selected?.id, 'mb-test');
});

test('isLeadIncomplete detects missing firstName, company, or jobTitle', () => {
  assert.equal(isLeadIncomplete(makeLead()), false);
  assert.equal(isLeadIncomplete(makeLead({ firstName: '' })), true);
  assert.equal(isLeadIncomplete(makeLead({ company: '   ' })), true);
  assert.equal(isLeadIncomplete(makeLead({ jobTitle: '' })), true);
});

test('reconcileLeadLists computes exact member count and verified count', () => {
  const lists: LeadList[] = [
    { id: 'list-a', workspaceId: 'ws-1', name: 'Alpha', description: '', leadCount: 99, tags: [], type: 'static', createdAt: '' },
    { id: 'list-b', workspaceId: 'ws-1', name: 'Beta', description: '', leadCount: 5, tags: [], type: 'static', createdAt: '' },
  ];
  const leads: Lead[] = [
    makeLead({ id: 'l1', listId: 'list-a', verificationStatus: 'valid' }),
    makeLead({ id: 'l2', listId: 'list-a', verificationStatus: 'unknown' }),
    makeLead({ id: 'l3', listId: 'list-a', verificationStatus: 'valid' }),
  ];

  const result = reconcileLeadLists(lists, leads);
  assert.equal(result[0].leadCount, 3);
  assert.equal(result[0].verifiedCount, 2);
  assert.equal(result[1].leadCount, 0);
  assert.equal(result[1].verifiedCount, 0);
});

test('reconcileCompanies computes lead counts and excludes lost deals from active value', () => {
  const companies: Company[] = [
    {
      id: 'c1',
      workspaceId: 'ws-1',
      name: 'Acme Inc',
      domain: 'acme.com',
      industry: 'SaaS',
      employeeCount: '50',
      location: 'Austin',
      leadsCount: 0,
      dealsCount: 0,
      totalValue: 0,
      createdAt: '2026-11-14T10:00:00.000Z',
    },
  ];
  const leads: Lead[] = [makeLead({ id: 'l1', company: 'Acme Inc', domain: 'acme.com' })];
  const deals: Deal[] = [
    {
      id: 'd1',
      workspaceId: 'ws-1',
      leadId: 'l1',
      leadName: 'Dana Scully',
      leadEmail: 'dana@acme.com',
      leadCompany: 'Acme Inc',
      title: 'Annual License',
      value: 15000,
      stage: 'interested',
      owner: 'Owner',
      notes: '',
      createdAt: '2026-11-14T10:00:00.000Z',
      updatedAt: '2026-11-14T10:00:00.000Z',
    },
    {
      id: 'd2',
      workspaceId: 'ws-1',
      leadId: 'l1',
      leadName: 'Dana Scully',
      leadEmail: 'dana@acme.com',
      leadCompany: 'Acme Inc',
      title: 'Lost Expansion',
      value: 50000,
      stage: 'lost',
      owner: 'Owner',
      notes: '',
      createdAt: '2026-11-14T10:00:00.000Z',
      updatedAt: '2026-11-14T10:00:00.000Z',
    },
  ];

  const reconciled = reconcileCompanies(companies, leads, deals);
  assert.equal(reconciled[0].leadsCount, 1);
  assert.equal(reconciled[0].dealsCount, 1);
  assert.equal(reconciled[0].totalValue, 15000);
});

test('computeAnalyticsSummary aggregates real production senders, 7-day job series, and variant stats', () => {
  const todayIso = new Date().toISOString();
  const leads: Lead[] = [
    makeLead({ id: 'l1', verificationStatus: 'valid' }),
    makeLead({ id: 'l2', verificationStatus: 'unknown' }),
  ];
  const mailboxes: MailboxAccount[] = [
    makeMailbox({ id: 'mb-1', status: 'connected', isTestMailbox: false, dailyLimit: 50, sentToday: 4 }),
    makeMailbox({ id: 'mb-2', status: 'reauth_required', isTestMailbox: false, dailyLimit: 50, sentToday: 2 }),
    makeMailbox({ id: 'mb-3', status: 'connected', isTestMailbox: true, dailyLimit: 100, sentToday: 1 }),
  ];
  const campaigns: Campaign[] = [
    {
      id: 'camp-1',
      workspaceId: 'ws-1',
      name: 'Guest Post Outreach',
      description: '',
      status: 'active',
      leadListId: 'list-1',
      mailboxAccountIds: ['mb-1'],
      schedule: {
        startDate: '2026-11-14',
        sendingDays: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'America/Chicago',
        useRecipientTimezone: true,
        minIntervalSeconds: 60,
      },
      settings: {
        dailyLimit: 50,
        maxNewLeadsPerDay: 25,
        maxPerDomainPerDay: 2,
        mailboxRotation: 'balanced',
        stopOnReply: true,
        stopOnUnsubscribe: true,
        trackOpens: true,
        trackClicks: true,
        plainTextOnly: false,
      },
      steps: [
        {
          id: 'step-1',
          campaignId: 'camp-1',
          stepNumber: 1,
          type: 'email',
          delayHours: 0,
          emailData: {
            subject: 'Subj',
            body: 'Body',
            variants: [
              { id: 'v-a', name: 'Variant A', subject: 'A', body: 'Body A', weight: 50, sentCount: 2, replyCount: 1 },
              { id: 'v-b', name: 'Variant B', subject: 'B', body: 'Body B', weight: 50, sentCount: 0, replyCount: 0 },
            ],
          },
        },
      ],
      stats: {
        enrolled: 2,
        sent: 2,
        delivered: 2,
        opened: 1,
        replied: 1,
        positiveReplies: 1,
        meetingsBooked: 0,
        bounced: 0,
        unsubscribed: 0,
      },
      createdAt: todayIso,
      updatedAt: todayIso,
    },
  ];
  const sendingJobs: SendingJob[] = [
    {
      id: 'job-1',
      workspaceId: 'ws-1',
      campaignId: 'camp-1',
      campaignName: 'Guest Post Outreach',
      leadId: 'l1',
      leadEmail: 'dana@acme.com',
      leadName: 'Dana',
      mailboxId: 'mb-1',
      mailboxEmail: 'sender@acme.com',
      stepId: 'step-1',
      stepNumber: 1,
      variantId: 'v-a',
      subject: 'Subj',
      body: 'Body',
      status: 'sent',
      attempts: 1,
      maxAttempts: 3,
      idempotencyKey: 'k1',
      scheduledAt: todayIso,
      sentAt: todayIso,
      createdAt: todayIso,
      updatedAt: todayIso,
    },
  ];
  const conversations: Conversation[] = [
    {
      id: 'conv-1',
      workspaceId: 'ws-1',
      leadId: 'l1',
      leadName: 'Dana Scully',
      leadEmail: 'dana@acme.com',
      leadCompany: 'Acme Inc',
      campaignId: 'camp-1',
      campaignName: 'Guest Post Outreach',
      mailboxId: 'mb-1',
      mailboxEmail: 'sender@acme.com',
      subject: 'Re: Subj',
      snippet: 'Yes interested',
      status: 'unread',
      category: 'interested',
      lastMessageAt: todayIso,
      messages: [
        {
          id: 'm1',
          sender: 'Dana Scully',
          senderEmail: 'dana@acme.com',
          recipientEmail: 'sender@acme.com',
          subject: 'Re: Subj',
          body: 'Yes interested',
          timestamp: todayIso,
          isInbound: true,
        },
      ],
    },
  ];
  const deals: Deal[] = [
    {
      id: 'deal-1',
      workspaceId: 'ws-1',
      leadId: 'l1',
      leadName: 'Dana',
      leadEmail: 'dana@acme.com',
      leadCompany: 'Acme Inc',
      title: 'Acme Annual',
      value: 12000,
      stage: 'proposal_sent',
      owner: 'Owner',
      notes: '',
      createdAt: todayIso,
      updatedAt: todayIso,
    },
  ];

  const summary = computeAnalyticsSummary({
    leads,
    campaigns,
    mailboxes,
    conversations,
    sendingJobs,
    deals,
  });

  assert.equal(summary.totalLeads, 2);
  assert.equal(summary.verifiedLeads, 1);
  assert.equal(summary.connectedProductionMailboxesCount, 1);
  assert.equal(summary.reauthRequiredMailboxesCount, 1);
  assert.equal(summary.testMailboxesCount, 1);
  assert.equal(summary.totalDailyProductionCapacity, 50);
  assert.equal(summary.totalSentTodayProduction, 4);
  assert.equal(summary.totalSent, 2);
  assert.equal(summary.totalOpened, 1);
  assert.equal(summary.openRate, 50);
  assert.equal(summary.totalReplies, 1);
  assert.equal(summary.replyRate, 50);
  assert.equal(summary.openPipelineValue, 12000);
  assert.equal(summary.variantResults.length, 2);
  assert.equal(summary.variantResults[0].replyRate, 50);
  assert.equal(summary.dailySeries.length, 7);
  assert.equal(summary.dailySeries[6].sent, 1);
  assert.equal(summary.dailySeries[6].replied, 1);
});
