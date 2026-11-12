import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase, saveDatabase } from './db';
import { Campaign, Lead, MailboxAccount } from '../types';
import { enrollAllActiveCampaigns, enrollCampaignLeadsIntoQueue } from './scheduler';
import {
  isWorkerSendingActive,
  setWorkerSendingActive,
  activateKillSwitch,
  pauseAllCampaigns,
  clearPendingQueue,
} from './worker';
import { enqueueJob } from './queue';

test('Campaign Execution: Worker sending defaults to safe inactive state unless explicitly enabled', () => {
  setWorkerSendingActive(false);
  assert.equal(isWorkerSendingActive(), false);

  setWorkerSendingActive(true);
  assert.equal(isWorkerSendingActive(), true);

  setWorkerSendingActive(false);
});

test('Campaign Launch: Immediate Send enqueues jobs and ignores schedule window when forced', () => {
  const db = getDatabase();
  const testCampId = `camp-imm-${Date.now()}`;
  const testListId = `list-imm-${Date.now()}`;
  const testLeadId = `lead-imm-${Date.now()}`;
  const testMbId = `mb-imm-${Date.now()}`;

  const testMailbox: MailboxAccount = {
    id: testMbId,
    workspaceId: db.workspace.id,
    email: 'outreach@example.com',
    name: 'Outreach Rep',
    provider: 'smtp',
    status: 'connected',
    dailyLimit: 100,
    sentToday: 0,
    warmupStatus: 'disabled',
    warmupScore: 100,
    healthScore: 100,
    signature: 'Best regards',
    lastSyncAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const testLead: Lead = {
    id: testLeadId,
    workspaceId: db.workspace.id,
    firstName: 'Alex',
    lastName: 'Rivera',
    fullName: 'Alex Rivera',
    email: `alex-${Date.now()}@testcompany.org`,
    jobTitle: 'Director of Growth',
    company: 'Test Company',
    website: 'testcompany.org',
    domain: 'testcompany.org',
    industry: 'Technology',
    country: 'United States',
    city: 'Austin',
    linkedinUrl: '',
    phone: '',
    source: 'Direct Entry',
    verificationStatus: 'valid',
    status: 'new',
    assignedOwner: 'Rep',
    customFields: {},
    notes: '',
    tags: [],
    dateAdded: new Date().toISOString(),
    unsubscribeStatus: false,
    bounceStatus: false,
    listId: testListId,
  };

  const testCampaign: Campaign = {
    id: testCampId,
    workspaceId: db.workspace.id,
    name: 'Immediate Test Campaign',
    description: 'Testing Send Now action',
    status: 'active',
    leadListId: testListId,
    mailboxAccountIds: [testMbId],
    settings: {
      dailyLimit: 50,
      maxNewLeadsPerDay: 20,
      maxPerDomainPerDay: 1,
      mailboxRotation: 'balanced',
      stopOnReply: true,
      stopOnUnsubscribe: true,
      trackOpens: true,
      trackClicks: true,
      plainTextOnly: false,
    },
    stats: {
      enrolled: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      replied: 0,
      positiveReplies: 0,
      bounced: 0,
      unsubscribed: 0,
      meetingsBooked: 0,
    },
    schedule: {
      startDate: '2099-01-01', // Far in the future! Window would reject normal sends
      sendingDays: [1, 2, 3, 4, 5],
      startTime: '00:00',
      endTime: '00:01',
      timezone: 'America/Los_Angeles',
      minIntervalSeconds: 60,
      useRecipientTimezone: true,
    },
    steps: [
      {
        id: `step-${Date.now()}`,
        campaignId: testCampId,
        stepNumber: 1,
        type: 'email',
        delayHours: 0,
        emailData: {
          subject: 'Immediate delivery test for {{company}}',
          body: 'Hello {{first_name}}, testing immediate dispatch.',
          variants: [],
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.mailboxes.push(testMailbox);
  db.leads.push(testLead);
  db.campaigns.push(testCampaign);
  saveDatabase(db);

  try {
    // Normal enrollment would return 0 due to future schedule window
    const normalEnqueued = enrollCampaignLeadsIntoQueue(testCampaign, new Date(), false);
    assert.equal(normalEnqueued, 0, 'Normal enrollment should be blocked by future schedule window');

    // "Send Campaign Now" forced enrollment succeeds
    const forceEnqueued = enrollCampaignLeadsIntoQueue(testCampaign, new Date(), true);
    assert.equal(forceEnqueued, 1, 'Forced enrollment should bypass schedule window and queue 1 job');

    // Verify job in database
    const freshDb = getDatabase();
    const queuedJob = freshDb.sendingJobs.find((j) => j.campaignId === testCampId && j.leadId === testLeadId);
    assert.ok(queuedJob, 'Job is queued in durable queue');
    assert.equal(queuedJob.status, 'queued');
  } finally {
    // Cleanup test fixtures
    const freshDb = getDatabase();
    freshDb.mailboxes = freshDb.mailboxes.filter((m) => m.id !== testMbId);
    freshDb.leads = freshDb.leads.filter((l) => l.id !== testLeadId);
    freshDb.campaigns = freshDb.campaigns.filter((c) => c.id !== testCampId);
    freshDb.sendingJobs = freshDb.sendingJobs.filter((j) => j.campaignId !== testCampId);
    saveDatabase(freshDb);
  }
});

test('Campaign Scheduling: Scheduled campaign transitions to active when start time arrives', () => {
  const db = getDatabase();
  const schedCampId = `camp-sched-${Date.now()}`;

  const scheduledCampaign: Campaign = {
    id: schedCampId,
    workspaceId: db.workspace.id,
    name: 'Future Scheduled Campaign',
    description: 'Testing scheduler transition',
    status: 'scheduled',
    launchType: 'scheduled',
    scheduledStartAt: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
    leadListId: 'list-dummy',
    mailboxAccountIds: [],
    settings: {
      dailyLimit: 50,
      maxNewLeadsPerDay: 20,
      maxPerDomainPerDay: 1,
      mailboxRotation: 'balanced',
      stopOnReply: true,
      stopOnUnsubscribe: true,
      trackOpens: true,
      trackClicks: true,
      plainTextOnly: false,
    },
    stats: {
      enrolled: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      replied: 0,
      positiveReplies: 0,
      bounced: 0,
      unsubscribed: 0,
      meetingsBooked: 0,
    },
    schedule: {
      startDate: new Date().toISOString().split('T')[0],
      sendingDays: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'America/Los_Angeles',
      minIntervalSeconds: 60,
      useRecipientTimezone: true,
    },
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.campaigns.push(scheduledCampaign);
  saveDatabase(db);

  try {
    enrollAllActiveCampaigns();
    const freshDb = getDatabase();
    const camp = freshDb.campaigns.find((c) => c.id === schedCampId);
    assert.equal(camp?.status, 'active', 'Campaign should have transitioned from scheduled to active');
    assert.ok(camp?.launchedAt, 'launchedAt timestamp recorded');
  } finally {
    const freshDb = getDatabase();
    freshDb.campaigns = freshDb.campaigns.filter((c) => c.id !== schedCampId);
    saveDatabase(freshDb);
  }
});

test('Safety Controls: Global Sending Kill Switch pauses campaigns and cancels queued jobs', () => {
  const db = getDatabase();
  const killCampId = `camp-kill-${Date.now()}`;
  setWorkerSendingActive(true);

  const activeCampaign: Campaign = {
    id: killCampId,
    workspaceId: db.workspace.id,
    name: 'Active Campaign For Kill Switch Test',
    description: '',
    status: 'active',
    leadListId: 'list-dummy',
    mailboxAccountIds: [],
    settings: {
      dailyLimit: 50,
      maxNewLeadsPerDay: 20,
      maxPerDomainPerDay: 1,
      mailboxRotation: 'balanced',
      stopOnReply: true,
      stopOnUnsubscribe: true,
      trackOpens: true,
      trackClicks: true,
      plainTextOnly: false,
    },
    stats: {
      enrolled: 1,
      sent: 0,
      delivered: 0,
      opened: 0,
      replied: 0,
      positiveReplies: 0,
      bounced: 0,
      unsubscribed: 0,
      meetingsBooked: 0,
    },
    schedule: {
      startDate: new Date().toISOString().split('T')[0],
      sendingDays: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'America/Los_Angeles',
      minIntervalSeconds: 60,
      useRecipientTimezone: true,
    },
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.campaigns.push(activeCampaign);

  const { job } = enqueueJob({
    workspaceId: db.workspace.id,
    campaignId: killCampId,
    leadId: 'lead-kill-1',
    leadEmail: 'victim@example.com',
    mailboxId: 'mb-dummy',
    stepId: 'step-1',
    stepNumber: 1,
    subject: 'To be killed',
    body: 'Will not send',
    scheduledAt: new Date().toISOString(),
  });

  saveDatabase(db);

  try {
    assert.equal(isWorkerSendingActive(), true);

    const killResult = activateKillSwitch();
    assert.ok(killResult.pausedCampaigns >= 1);
    assert.ok(killResult.cancelledJobs >= 1);
    assert.equal(isWorkerSendingActive(), false, 'Worker sending should be disabled');

    const freshDb = getDatabase();
    const updatedCamp = freshDb.campaigns.find((c) => c.id === killCampId);
    assert.equal(updatedCamp?.status, 'paused');

    const updatedJob = freshDb.sendingJobs.find((j) => j.id === job.id);
    assert.equal(updatedJob?.status, 'cancelled');
  } finally {
    const freshDb = getDatabase();
    freshDb.campaigns = freshDb.campaigns.filter((c) => c.id !== killCampId);
    freshDb.sendingJobs = freshDb.sendingJobs.filter((j) => j.campaignId !== killCampId);
    saveDatabase(freshDb);
  }
});
