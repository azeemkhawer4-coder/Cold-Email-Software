import test from 'node:test';
import assert from 'node:assert/strict';
import {
  composeOutboundEmail,
  buildMimeEmailString,
  analyzeEmailSpamRisk,
  isLegacyBoilerplateAddress,
  isLegacyBoilerplateFooter,
  isLegacyBoilerplateSignature,
} from './emailComposer';
import {
  isPublicTrackingUrl,
  resolveTrackingBaseUrl,
  buildOpenTrackingPixelUrl,
  recordOpenEventForState,
} from './openTracking';
import { Campaign, SendingEvent, SendingJob } from '../types';

test('composeOutboundEmail preserves paragraphs/line breaks in HTML and strips legacy spam boilerplate', () => {
  const composed = composeOutboundEmail({
    body: 'Hi Alex,\n\nI noticed your work at Acme.\n\nWould you be open to a quick chat?\n\nBest,\nSEO Expert',
    signature: '--\nBest regards,\nApex Outbound',
    physicalAddress: '548 Market St, Suite 39201, San Francisco, CA 94104',
    unsubscribeFooter:
      'You received this email because we identified synergy with your role. If you prefer not to receive future updates, click here to unsubscribe.',
    includeComplianceFooter: true,
    plainTextOnly: false,
    trackingPixelUrl: 'https://track.example.com/api/track/open/t_abc123.gif',
  });

  // Legacy spam boilerplate must NEVER appear even when includeComplianceFooter=true
  assert.equal(isLegacyBoilerplateAddress('548 Market St, Suite 39201, San Francisco, CA 94104'), true);
  assert.equal(
    isLegacyBoilerplateFooter(
      'You received this email because we identified synergy with your role. If you prefer not to receive future updates, click here to unsubscribe.'
    ),
    true
  );
  assert.equal(isLegacyBoilerplateSignature('--\nBest regards,\nApex Outbound'), true);

  assert.equal(composed.textBody.includes('548 Market St'), false);
  assert.equal(composed.textBody.includes('identified synergy'), false);
  assert.equal(composed.textBody.includes('Apex Outbound'), false);
  assert.equal(composed.textBody.includes('-- --'), false);

  // HTML preserves paragraphs & line breaks instead of collapsing into a single wall of text
  assert.ok(composed.htmlBody);
  assert.ok(composed.htmlBody.includes('<div style="margin: 0 0 12px 0;">Hi Alex,</div>'));
  assert.ok(composed.htmlBody.includes('Best,<br>SEO Expert'));
  assert.equal(composed.pixelInjected, true);
  assert.ok(composed.htmlBody.includes('https://track.example.com/api/track/open/t_abc123.gif'));
});

test('composeOutboundEmail rejects localhost tracking URLs and respects plainTextOnly', () => {
  const localhostAttempt = composeOutboundEmail({
    body: 'Hello Sam,\n\nChecking in.',
    plainTextOnly: false,
    trackingPixelUrl: 'http://localhost:3000/api/track/open/t_123.gif',
  });
  assert.equal(localhostAttempt.pixelInjected, false);
  assert.equal(localhostAttempt.htmlBody?.includes('localhost'), false);

  const plainOnly = composeOutboundEmail({
    body: 'Hello Sam,\n\nChecking in.',
    plainTextOnly: true,
    trackingPixelUrl: 'https://track.example.com/api/track/open/t_123.gif',
  });
  assert.equal(plainOnly.pixelInjected, false);
  assert.equal(plainOnly.htmlBody, undefined);
});

test('composeOutboundEmail avoids duplicate "-- --" signature separators for custom signatures', () => {
  const composed = composeOutboundEmail({
    body: 'Hi Taylor,\n\nQuick question about Q4.',
    signature: '--\nAzeem\nFounder',
    includeComplianceFooter: false,
    plainTextOnly: false,
  });

  assert.equal(composed.textBody.includes('-- --'), false);
  assert.ok(composed.textBody.endsWith('Azeem\nFounder'));
});

test('buildMimeEmailString builds clean multipart/alternative without X-Mailer spam headers', () => {
  const rawMime = buildMimeEmailString({
    fromName: 'Marlar Kannan',
    fromEmail: 'marlarkannanseo@gmail.com',
    toEmail: 'prospect@example.com',
    subject: 'Quick question about Ecom',
    textBody: 'Hi Alex,\n\nQuick note.',
    htmlBody: '<div dir="ltr"><div>Hi Alex,</div><div>Quick note.</div></div>',
    plainTextOnly: false,
  });

  assert.equal(rawMime.includes('X-Mailer'), false);
  assert.equal(rawMime.includes('X-OutboundOS'), false);
  assert.ok(rawMime.includes('Content-Type: multipart/alternative;'));
  assert.ok(rawMime.includes('Content-Type: text/plain; charset="UTF-8"'));
  assert.ok(rawMime.includes('Content-Type: text/html; charset="UTF-8"'));
  assert.ok(rawMime.includes('Subject: Quick question about Ecom\r\n'));

  const plainMime = buildMimeEmailString({
    fromName: 'Marlar Kannan',
    fromEmail: 'marlarkannanseo@gmail.com',
    toEmail: 'prospect@example.com',
    subject: 'Plain note',
    textBody: 'Hi Alex,\n\nJust following up.',
    plainTextOnly: true,
  });

  assert.ok(plainMime.includes('Content-Type: text/plain; charset="UTF-8"'));
  assert.equal(plainMime.includes('multipart/alternative'), false);
});

test('openTracking URL validation rejects localhost and deduplicates unique opens cleanly', () => {
  assert.equal(isPublicTrackingUrl('http://localhost:3000'), false);
  assert.equal(isPublicTrackingUrl('http://127.0.0.1:3000'), false);
  assert.equal(isPublicTrackingUrl('https://outreach.example.com/'), true);

  assert.equal(
    resolveTrackingBaseUrl('', 'http://localhost:3000', 'https://app.example.com/'),
    'https://app.example.com'
  );
  assert.equal(
    buildOpenTrackingPixelUrl('https://app.example.com/', 't_xyz'),
    'https://app.example.com/api/track/open/t_xyz.gif'
  );

  const campaigns: Campaign[] = [
    {
      id: 'camp-1',
      workspaceId: 'ws-1',
      name: 'Test',
      description: '',
      status: 'active',
      leadListId: 'list-1',
      mailboxAccountIds: [],
      schedule: {
        startDate: '2026-11-16',
        sendingDays: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'UTC',
        useRecipientTimezone: false,
        minIntervalSeconds: 60,
      },
      settings: {
        dailyLimit: 50,
        maxNewLeadsPerDay: 20,
        maxPerDomainPerDay: 2,
        mailboxRotation: 'balanced',
        stopOnReply: true,
        stopOnUnsubscribe: true,
        trackOpens: true,
        trackClicks: false,
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
              { id: 'v-a', name: 'A', subject: 'Subj', body: 'Body', weight: 100, sentCount: 1, replyCount: 0 },
            ],
          },
        },
      ],
      stats: {
        enrolled: 1,
        sent: 1,
        delivered: 1,
        opened: 0,
        replied: 0,
        positiveReplies: 0,
        bounced: 0,
        unsubscribed: 0,
        meetingsBooked: 0,
      },
      createdAt: '2026-11-16T00:00:00.000Z',
      updatedAt: '2026-11-16T00:00:00.000Z',
    },
  ];

  const sendingJobs: SendingJob[] = [
    {
      id: 'job-1',
      idempotencyKey: 'k1',
      workspaceId: 'ws-1',
      campaignId: 'camp-1',
      leadId: 'lead-1',
      leadEmail: 'lead@example.com',
      mailboxId: 'mb-1',
      stepId: 'step-1',
      stepNumber: 1,
      variantId: 'v-a',
      subject: 'Subj',
      body: 'Body',
      trackingToken: 't_token_1',
      scheduledAt: '2026-11-16T00:00:00.000Z',
      status: 'sent',
      attempts: 1,
      maxAttempts: 3,
      createdAt: '2026-11-16T00:00:00.000Z',
      updatedAt: '2026-11-16T00:00:00.000Z',
    },
  ];

  const sendingEvents: SendingEvent[] = [];

  // First open -> increments campaign.stats.opened & variant.openCount
  const first = recordOpenEventForState({
    tokenOrJobId: 't_token_1.gif',
    workspaceId: 'ws-1',
    sendingJobs,
    campaigns,
    sendingEvents,
    nowIso: '2026-11-16T01:00:00.000Z',
  });
  assert.equal(first.matched, true);
  assert.equal(first.firstOpen, true);
  assert.equal(campaigns[0].stats.opened, 1);
  assert.equal(campaigns[0].steps[0].emailData?.variants[0].openCount, 1);
  assert.equal(sendingJobs[0].openCount, 1);

  // Second open (e.g. proxy re-fetch) -> logs event & openCount=2, but keeps unique opened=1
  const second = recordOpenEventForState({
    tokenOrJobId: 't_token_1.gif',
    workspaceId: 'ws-1',
    sendingJobs,
    campaigns,
    sendingEvents,
    nowIso: '2026-11-16T01:05:00.000Z',
  });
  assert.equal(second.matched, true);
  assert.equal(second.firstOpen, false);
  assert.equal(campaigns[0].stats.opened, 1);
  assert.equal(sendingJobs[0].openCount, 2);
  assert.equal(sendingEvents.length, 2);
});

test('analyzeEmailSpamRisk flags spam boilerplate and localhost URLs', () => {
  const risky = analyzeEmailSpamRisk({
    subject: 'URGENT ACT NOW',
    body: 'We identified synergy with your role. Visit http://localhost:3000/unsub',
    physicalAddress: '548 Market St, Suite 39201, San Francisco, CA 94104',
  });
  assert.equal(risky.status, 'high_risk');
  assert.ok(risky.detectedIssues.some((i) => i.includes('localhost')));
  assert.ok(risky.detectedIssues.some((i) => i.includes('548 Market St')));

  const clean = analyzeEmailSpamRisk({
    subject: 'Guest post idea for Acme',
    body: 'Hi Dana,\n\nLoved your recent piece on ops scaling.\n\nWould you be open to an original guest article for your blog?\n\nBest,\nAzeem',
  });
  assert.equal(clean.status, 'safe');
  assert.equal(clean.spamScore, 100);
});
