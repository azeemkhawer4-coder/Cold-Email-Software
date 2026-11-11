import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNextSequenceStep } from './scheduler';
import { Campaign, Lead, SendingJob } from '../types';
import { getDatabase } from './db';

const baseLead: Lead = {
  id: 'lead-test-seq-1',
  workspaceId: 'ws-test',
  firstName: 'Sarah',
  lastName: 'Connor',
  fullName: 'Sarah Connor',
  email: 'sarah@skynet-defense.com',
  jobTitle: 'Head of Infrastructure',
  company: 'Skynet Cyberdyne',
  website: 'https://cyberdyne.com',
  domain: 'skynet-defense.com',
  industry: 'Technology',
  country: 'United States',
  city: 'Los Angeles',
  linkedinUrl: '',
  phone: '',
  source: 'Manual',
  verificationStatus: 'valid',
  status: 'new',
  assignedOwner: 'Azeem',
  customFields: {
    infrastructure_stack: 'Kubernetes on AWS',
    quarterly_priority: 'latency reduction',
  },
  notes: '',
  tags: ['Enterprise'],
  dateAdded: new Date().toISOString(),
  unsubscribeStatus: false,
  bounceStatus: false,
};

const linearCampaign: Campaign = {
  id: 'camp-linear-test',
  workspaceId: 'ws-test',
  name: 'Linear Sequence Test',
  description: 'Test linear steps and delay',
  status: 'active',
  leadListId: 'list-1',
  mailboxAccountIds: ['mb-test-1'],
  schedule: {
    startDate: '2026-01-01',
    sendingDays: [1, 2, 3, 4, 5, 6, 7],
    startTime: '00:00',
    endTime: '23:59',
    timezone: 'UTC',
    useRecipientTimezone: false,
    minIntervalSeconds: 60,
  },
  settings: {
    dailyLimit: 100,
    maxNewLeadsPerDay: 50,
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
      campaignId: 'camp-linear-test',
      stepNumber: 1,
      type: 'email',
      delayHours: 0,
      emailData: {
        subject: 'Intro to {{company}}',
        body: 'Hi {{first_name | fallback: "there"}},\n\nInterested in {{quarterly_priority | fallback: "growth"}}?',
        variants: [
          {
            id: 'var-a',
            name: 'Variant A - Direct',
            subject: 'Direct question for {{company}}',
            body: 'Hi {{first_name}}, direct pitch here.',
            weight: 50,
            sentCount: 0,
            replyCount: 0,
          },
          {
            id: 'var-b',
            name: 'Variant B - Social Proof',
            subject: 'Case study for {{company}}',
            body: 'Hi {{first_name}}, benchmark case study here.',
            weight: 50,
            sentCount: 0,
            replyCount: 0,
          },
        ],
      },
    },
    {
      id: 'step-2',
      campaignId: 'camp-linear-test',
      stepNumber: 2,
      type: 'delay',
      delayHours: 48,
    },
    {
      id: 'step-3',
      campaignId: 'camp-linear-test',
      stepNumber: 3,
      type: 'email',
      delayHours: 0,
      emailData: {
        subject: 'Re: Intro to {{company}}',
        body: 'Hi {{first_name}}, following up.',
        variants: [],
      },
    },
  ],
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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test('Linear Sequence: fresh lead resolves to Step 1 with variant selection', () => {
  const now = new Date('2026-11-10T10:00:00Z');
  const result = resolveNextSequenceStep(linearCampaign, baseLead, [], now);

  assert.ok(result.nextStep !== null);
  assert.equal(result.nextStep?.stepNumber, 1);
  assert.equal(result.nextStep?.type, 'email');
  assert.ok(result.chosenVariant !== undefined);
  assert.ok(['var-a', 'var-b'].includes(result.chosenVariant!.id));
});

test('Linear Sequence: delay calculation after Step 1 sent', () => {
  const sentAt = new Date('2026-11-10T10:00:00Z');
  const now = new Date('2026-11-10T12:00:00Z'); // 2 hours after Step 1 sent (less than 48h)

  const leadJobs: SendingJob[] = [
    {
      id: 'job-1',
      idempotencyKey: 'ik_camp_step1',
      workspaceId: 'ws-test',
      campaignId: linearCampaign.id,
      leadId: baseLead.id,
      leadEmail: baseLead.email,
      mailboxId: 'mb-test-1',
      stepId: 'step-1',
      stepNumber: 1,
      subject: 'Intro to Skynet Cyberdyne',
      body: 'Body',
      scheduledAt: sentAt.toISOString(),
      sentAt: sentAt.toISOString(),
      status: 'sent',
      attempts: 1,
      maxAttempts: 3,
      createdAt: sentAt.toISOString(),
      updatedAt: sentAt.toISOString(),
    },
  ];

  const result = resolveNextSequenceStep(linearCampaign, baseLead, leadJobs, now);

  assert.ok(result.nextStep !== null);
  assert.equal(result.nextStep?.stepNumber, 3);
  // Expected scheduled time is sentAt + 48 hours
  const expectedScheduledTime = new Date(sentAt.getTime() + 48 * 3600000).toISOString();
  assert.equal(result.scheduledAt, expectedScheduledTime);
});

test('Linear Sequence: completes when all email steps are sent', () => {
  const leadJobs: SendingJob[] = [
    {
      id: 'job-1',
      idempotencyKey: 'ik_1',
      workspaceId: 'ws-test',
      campaignId: linearCampaign.id,
      leadId: baseLead.id,
      leadEmail: baseLead.email,
      mailboxId: 'mb-test-1',
      stepId: 'step-1',
      stepNumber: 1,
      subject: 'Subject 1',
      body: 'Body 1',
      scheduledAt: '2026-11-01T10:00:00Z',
      sentAt: '2026-11-01T10:00:00Z',
      status: 'sent',
      attempts: 1,
      maxAttempts: 3,
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    },
    {
      id: 'job-2',
      idempotencyKey: 'ik_2',
      workspaceId: 'ws-test',
      campaignId: linearCampaign.id,
      leadId: baseLead.id,
      leadEmail: baseLead.email,
      mailboxId: 'mb-test-1',
      stepId: 'step-3',
      stepNumber: 3,
      subject: 'Subject 2',
      body: 'Body 2',
      scheduledAt: '2026-11-03T10:00:00Z',
      sentAt: '2026-11-03T10:00:00Z',
      status: 'sent',
      attempts: 1,
      maxAttempts: 3,
      createdAt: '2026-11-03T10:00:00Z',
      updatedAt: '2026-11-03T10:00:00Z',
    },
  ];

  const result = resolveNextSequenceStep(linearCampaign, baseLead, leadJobs, new Date('2026-11-05T10:00:00Z'));
  assert.equal(result.nextStep, null, 'Sequence should be terminated once all steps are sent');
});

test('Conditional Branching: routes to NO branch when condition is not met (unreplied)', () => {
  const branchCampaign: Campaign = {
    ...linearCampaign,
    id: 'camp-branch-test',
    steps: [
      {
        id: 'b-step-1',
        campaignId: 'camp-branch-test',
        stepNumber: 1,
        type: 'email',
        delayHours: 0,
        emailData: { subject: 'Step 1', body: 'Body 1', variants: [] },
      },
      {
        id: 'b-step-2',
        campaignId: 'camp-branch-test',
        stepNumber: 2,
        type: 'delay',
        delayHours: 24,
      },
      {
        id: 'b-step-3',
        campaignId: 'camp-branch-test',
        stepNumber: 3,
        type: 'condition',
        conditionType: 'if_replied',
        delayHours: 0,
        yesStepNumber: 4, // Meeting link email
        noStepNumber: 5,  // Follow-up bump email
      },
      {
        id: 'b-step-4',
        campaignId: 'camp-branch-test',
        stepNumber: 4,
        type: 'email',
        delayHours: 0,
        emailData: { subject: 'Great to connect! Booking link', body: 'Link', variants: [] },
      },
      {
        id: 'b-step-5',
        campaignId: 'camp-branch-test',
        stepNumber: 5,
        type: 'email',
        delayHours: 0,
        emailData: { subject: 'Did you get my note?', body: 'Following up', variants: [] },
      },
    ],
  };

  const sentAt = new Date('2026-11-08T10:00:00Z');
  const now = new Date('2026-11-10T10:00:00Z'); // 48h later

  const leadJobs: SendingJob[] = [
    {
      id: 'job-b1',
      idempotencyKey: 'ik_b1',
      workspaceId: 'ws-test',
      campaignId: branchCampaign.id,
      leadId: baseLead.id,
      leadEmail: baseLead.email,
      mailboxId: 'mb-test-1',
      stepId: 'b-step-1',
      stepNumber: 1,
      subject: 'Step 1',
      body: 'Body 1',
      scheduledAt: sentAt.toISOString(),
      sentAt: sentAt.toISOString(),
      status: 'sent',
      attempts: 1,
      maxAttempts: 3,
      createdAt: sentAt.toISOString(),
      updatedAt: sentAt.toISOString(),
    },
  ];

  // Lead has not replied
  const unrepliedLead: Lead = { ...baseLead, status: 'contacted', lastReply: undefined };
  const result = resolveNextSequenceStep(branchCampaign, unrepliedLead, leadJobs, now);

  assert.ok(result.nextStep !== null);
  assert.equal(result.nextStep?.stepNumber, 5, 'Unreplied lead should route to step 5 (NO branch)');
  assert.equal(result.nextStep?.emailData?.subject, 'Did you get my note?');
});

test('Conditional Branching: routes to YES branch when condition is met (replied)', () => {
  const branchCampaign: Campaign = {
    ...linearCampaign,
    id: 'camp-branch-test-2',
    steps: [
      {
        id: 'b-step-1',
        campaignId: 'camp-branch-test-2',
        stepNumber: 1,
        type: 'email',
        delayHours: 0,
        emailData: { subject: 'Step 1', body: 'Body 1', variants: [] },
      },
      {
        id: 'b-step-2',
        campaignId: 'camp-branch-test-2',
        stepNumber: 2,
        type: 'delay',
        delayHours: 24,
      },
      {
        id: 'b-step-3',
        campaignId: 'camp-branch-test-2',
        stepNumber: 3,
        type: 'condition',
        conditionType: 'if_replied',
        delayHours: 0,
        yesStepNumber: 4, // Meeting link email
        noStepNumber: 5,  // Follow-up bump email
      },
      {
        id: 'b-step-4',
        campaignId: 'camp-branch-test-2',
        stepNumber: 4,
        type: 'email',
        delayHours: 0,
        emailData: { subject: 'Great to connect! Booking link', body: 'Link', variants: [] },
      },
      {
        id: 'b-step-5',
        campaignId: 'camp-branch-test-2',
        stepNumber: 5,
        type: 'email',
        delayHours: 0,
        emailData: { subject: 'Did you get my note?', body: 'Following up', variants: [] },
      },
    ],
  };

  const sentAt = new Date('2026-11-08T10:00:00Z');
  const now = new Date('2026-11-10T10:00:00Z');

  const leadJobs: SendingJob[] = [
    {
      id: 'job-b1',
      idempotencyKey: 'ik_b1_replied',
      workspaceId: 'ws-test',
      campaignId: branchCampaign.id,
      leadId: baseLead.id,
      leadEmail: baseLead.email,
      mailboxId: 'mb-test-1',
      stepId: 'b-step-1',
      stepNumber: 1,
      subject: 'Step 1',
      body: 'Body 1',
      scheduledAt: sentAt.toISOString(),
      sentAt: sentAt.toISOString(),
      status: 'sent',
      attempts: 1,
      maxAttempts: 3,
      createdAt: sentAt.toISOString(),
      updatedAt: sentAt.toISOString(),
    },
  ];

  // Lead has replied
  const repliedLead: Lead = {
    ...baseLead,
    status: 'replied',
    lastReply: '2026-11-09T14:30:00Z',
  };

  const result = resolveNextSequenceStep(branchCampaign, repliedLead, leadJobs, now);

  assert.ok(result.nextStep !== null);
  assert.equal(result.nextStep?.stepNumber, 4, 'Replied lead should route to step 4 (YES branch)');
  assert.equal(result.nextStep?.emailData?.subject, 'Great to connect! Booking link');
});

test('Termination Safeguards: bounces and unsubscribes are immediately terminated', () => {
  const bouncedLead: Lead = { ...baseLead, bounceStatus: true };
  const unsubscribedLead: Lead = { ...baseLead, unsubscribeStatus: true };

  const res1 = resolveNextSequenceStep(linearCampaign, bouncedLead, []);
  assert.equal(res1.nextStep, null, 'Bounced lead must not receive next sequence step');

  const res2 = resolveNextSequenceStep(linearCampaign, unsubscribedLead, []);
  assert.equal(res2.nextStep, null, 'Unsubscribed lead must not receive next sequence step');
});
