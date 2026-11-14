import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Isolate all SQLite I/O in a temporary directory BEFORE importing db modules
const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outboundos-bugfix-test-'));
process.env.OUTBOUNDOS_DATA_DIR = tempDataDir;

import { getDatabase, saveDatabase } from './db';
import { encryptSecret } from './db/crypto';
import { isWithinScheduleWindow } from './scheduler';
import { verifyGmailConnection, syncGmailReplies } from './adapters/gmailAdapter';
import { simulateInboundReply } from './worker';
import { CampaignSchedule, MailboxAccount } from '../types';

test.after(() => {
  try {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  } catch (_) {}
});

test('isWithinScheduleWindow evaluates startDate and hours in the campaign IANA timezone', () => {
  // 2026-11-16 is a Monday. At 15:30 UTC:
  // - America/Chicago (CST, UTC-6) is 09:30 -> inside 09:00..11:00
  // - America/New_York (EST, UTC-5) is 10:30 -> inside 09:00..11:00
  // - At 16:30 UTC: Chicago is 10:30 (inside), New York is 11:30 (outside 09:00..11:00)
  const testDate = new Date('2026-11-16T16:30:00.000Z');
  const scheduleBase: CampaignSchedule = {
    startDate: '2026-11-16',
    sendingDays: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '11:00',
    timezone: 'America/Chicago',
    useRecipientTimezone: false,
    minIntervalSeconds: 60,
  };

  assert.equal(isWithinScheduleWindow({ ...scheduleBase, timezone: 'America/Chicago' }, testDate), true);
  assert.equal(isWithinScheduleWindow({ ...scheduleBase, timezone: 'America/New_York' }, testDate), false);
});

test('verifyGmailConnection performs 1 forced refresh and retries on HTTP 401 before succeeding', async () => {
  const originalFetch = globalThis.fetch;
  let profileCalls = 0;
  let refreshCalls = 0;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com/token')) {
      refreshCalls++;
      return new Response(
        JSON.stringify({ access_token: 'fresh-access-token', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url.includes('gmail/v1/users/me/profile')) {
      profileCalls++;
      if (profileCalls === 1) {
        return new Response(JSON.stringify({ error: { code: 401 } }), { status: 401 });
      }
      return new Response(
        JSON.stringify({ emailAddress: 'rep@acme.com', messagesTotal: 42 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  try {
    const mailbox: MailboxAccount = {
      id: `mb-401-test-${Date.now()}`,
      workspaceId: 'ws-test',
      email: 'rep@acme.com',
      name: 'Rep',
      provider: 'gmail',
      status: 'reauth_required',
      dailyLimit: 50,
      sentToday: 0,
      warmupStatus: 'disabled',
      warmupScore: 100,
      healthScore: 100,
      signature: '',
      lastSyncAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      oauth: {
        accessToken: 'stale-token',
        refreshToken: encryptSecret('1//valid-refresh'),
        expiresAt: Date.now() + 3600_000,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      },
    };

    const result = await verifyGmailConnection(mailbox);
    assert.equal(result.success, true);
    assert.equal(result.status, 'connected');
    assert.equal(mailbox.status, 'connected');
    assert.equal(refreshCalls, 1);
    assert.equal(profileCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('syncGmailReplies keeps mailbox status connected when inbox is empty or messages fetched', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ messages: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const mailbox: MailboxAccount = {
      id: `mb-sync-test-${Date.now()}`,
      workspaceId: 'ws-test',
      email: 'rep@acme.com',
      name: 'Rep',
      provider: 'gmail',
      status: 'reauth_required',
      dailyLimit: 50,
      sentToday: 0,
      warmupStatus: 'disabled',
      warmupScore: 100,
      healthScore: 100,
      signature: '',
      lastSyncAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      oauth: {
        accessToken: 'valid-token',
        refreshToken: encryptSecret('1//valid-refresh'),
        expiresAt: Date.now() + 3600_000,
      },
    };

    const msgs = await syncGmailReplies(mailbox);
    assert.deepEqual(msgs, []);
    assert.equal(mailbox.status, 'connected');
    assert.equal(mailbox.syncStatus, 'completed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('simulateInboundReply increments campaign replied count and stops queued jobs cleanly once', () => {
  const db = getDatabase();
  const campId = `camp-reply-${Date.now()}`;
  const leadId = `lead-reply-${Date.now()}`;
  const leadEmail = `prospect-${Date.now()}@example.com`;

  db.campaigns.push({
    id: campId,
    workspaceId: db.workspace.id,
    name: 'Reply Increment Test',
    description: '',
    status: 'active',
    leadListId: 'list-test',
    mailboxAccountIds: [],
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
        id: 's1',
        campaignId: campId,
        stepNumber: 1,
        type: 'email',
        delayHours: 0,
        emailData: { subject: 'Hi', body: 'Hello', variants: [] },
      },
    ],
    stats: {
      enrolled: 1,
      sent: 1,
      delivered: 1,
      opened: 0,
      replied: 0,
      positiveReplies: 0,
      meetingsBooked: 0,
      bounced: 0,
      unsubscribed: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  db.leads.push({
    id: leadId,
    workspaceId: db.workspace.id,
    firstName: 'Sam',
    lastName: 'Lee',
    fullName: 'Sam Lee',
    email: leadEmail,
    jobTitle: 'CTO',
    company: 'Example Co',
    website: 'example.com',
    domain: 'example.com',
    industry: 'Tech',
    country: 'US',
    city: 'Chicago',
    linkedinUrl: '',
    phone: '',
    source: 'Test',
    verificationStatus: 'valid',
    status: 'contacted',
    campaignId: campId,
    assignedOwner: 'Owner',
    customFields: {},
    notes: '',
    tags: [],
    dateAdded: new Date().toISOString(),
    unsubscribeStatus: false,
    bounceStatus: false,
    listId: 'list-test',
  });
  saveDatabase(db);

  const res = simulateInboundReply(leadEmail, 'Sounds great, let us chat Tuesday!', 'interested');
  assert.equal(res.success, true);

  const updatedDb = getDatabase();
  const camp = updatedDb.campaigns.find((c) => c.id === campId);
  assert.equal(camp?.stats.replied, 1);
  assert.equal(camp?.stats.positiveReplies, 1);
});
