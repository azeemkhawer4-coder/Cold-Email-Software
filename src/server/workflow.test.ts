import test from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase, saveDatabase } from './db';
import {
  provisionControlledTestMailbox,
  verifySmtpConnection,
  sendSmtpMessage,
} from './adapters/smtpImapAdapter';
import { enqueueJob, getDueJobs, markJobSent, markJobFailed, getQueueStats } from './queue';
import { dispatchRealEmail, processOutboundSendingBatch } from './worker';

test('End-to-End Workflow with Controlled Test Mailbox', async (t) => {
  const db = getDatabase();

  let testMailbox: any;

  await t.test('1. Provision real controlled test mailbox (Ethereal)', async () => {
    testMailbox = await provisionControlledTestMailbox(db.workspace.id);
    assert.ok(testMailbox.id, 'Mailbox ID exists');
    assert.ok(testMailbox.email.includes('@ethereal.email'), 'Mailbox email has ethereal domain');
    assert.ok(testMailbox.smtpHost, 'SMTP host is set');
    assert.ok(testMailbox.smtpUser, 'SMTP user is set');
    assert.ok(testMailbox.smtpPass, 'SMTP pass is set');
    assert.ok(testMailbox.imapHost, 'IMAP host is set');

    db.mailboxes.unshift(testMailbox);
    saveDatabase(db);
  });

  await t.test('2. Verify live SMTP handshake with test mailbox', async () => {
    const verification = await verifySmtpConnection(testMailbox);
    assert.equal(verification.valid, true, `Verification should succeed, got: ${verification.error}`);
  });

  await t.test('3. Enqueue job into durable queue with idempotency protection', () => {
    const runId = Date.now();
    const leadEmail = `prospect-${runId}@example.com`;
    const campaignId = `camp-test-${runId}`;
    const stepId = 'step-1';
    const leadId = `lead-${runId}`;

    const { job: job1, isDuplicate: isDup1 } = enqueueJob({
      workspaceId: db.workspace.id,
      campaignId,
      campaignName: 'Controlled Test Campaign',
      leadId,
      leadEmail,
      leadName: 'Controlled Prospect',
      mailboxId: testMailbox.id,
      mailboxEmail: testMailbox.email,
      stepId,
      stepNumber: 1,
      subject: 'OutboundOS Controlled Delivery Verification',
      body: '<p>Testing real delivery over wire.</p>',
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
    });

    assert.equal(isDup1, false, 'First enqueue is not duplicate');
    assert.equal(job1.status, 'queued');

    // Attempt to enqueue identical job
    const { job: job2, isDuplicate: isDup2 } = enqueueJob({
      workspaceId: db.workspace.id,
      campaignId,
      campaignName: 'Controlled Test Campaign',
      leadId,
      leadEmail,
      mailboxId: testMailbox.id,
      stepId,
      stepNumber: 1,
      subject: 'OutboundOS Controlled Delivery Verification',
      body: '<p>Testing real delivery over wire.</p>',
      scheduledAt: new Date().toISOString(),
    });

    assert.equal(isDup2, true, 'Second enqueue with same idempotency key is detected as duplicate');
    assert.equal(job1.id, job2.id, 'Returns original job reference');
  });

  await t.test('4. Perform real delivery over the wire via dispatchRealEmail', async () => {
    const result = await dispatchRealEmail(
      testMailbox.id,
      'verified.lead@example.com',
      'Real Ethereal Outbound Verification',
      'This message was dispatched over actual SMTP protocol without mock simulation.'
    );

    assert.equal(result.success, true, `Real delivery failed: ${result.error}`);
    assert.ok(result.messageId, 'Real message ID was returned by provider');
    assert.ok(result.previewUrl, 'Real preview URL returned from test rig');
    console.log('Real Ethereal Delivery confirmed! Message ID:', result.messageId);
    console.log('Preview URL:', result.previewUrl);
  });

  await t.test('5. Verify failure reporting on unauthenticated mailbox', async () => {
    // Create broken mailbox with bad SMTP host
    const brokenMailbox = {
      id: `mb-broken-test-${Date.now()}`,
      workspaceId: db.workspace.id,
      email: 'bad@nonexistent-mail-server-xyz123.com',
      name: 'Broken Mailbox',
      provider: 'smtp' as const,
      status: 'connected' as const,
      dailyLimit: 10,
      sentToday: 0,
      warmupStatus: 'disabled' as const,
      warmupScore: 50,
      healthScore: 50,
      signature: '',
      smtpHost: 'nonexistent-mail-server-xyz123.com',
      smtpPort: 587,
      smtpUser: 'test',
      smtpPass: 'test',
      lastSyncAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.mailboxes.push(brokenMailbox);
    saveDatabase(db);

    const result = await dispatchRealEmail(
      brokenMailbox.id,
      'prospect@example.com',
      'Test Fail',
      'This should fail'
    );

    assert.equal(result.success, false, 'Should fail for broken server');
    assert.ok(result.error, 'Real error is returned');
    assert.notEqual(result.failureType, undefined, 'Failure type is classified');

    // Enqueue a real job for failure test
    const { job: failJob } = enqueueJob({
      workspaceId: db.workspace.id,
      campaignId: 'camp-fail-test',
      leadId: 'lead-fail-01',
      leadEmail: 'prospect@example.com',
      mailboxId: brokenMailbox.id,
      stepId: 'step-1',
      stepNumber: 1,
      subject: 'Test Fail',
      body: 'Will fail',
      scheduledAt: new Date().toISOString(),
      maxAttempts: 1,
    });

    // Verify failure report generation
    const { job, report } = markJobFailed(
      failJob.id,
      result.error!,
      result.errorDetails,
      result.failureType,
      'smtp'
    );

    assert.equal(job.status, 'failed', 'Job marked failed after max attempts');
    assert.ok(report, 'Failure report created');
    assert.equal(report?.errorType, 'smtp_connect');
    console.log('Failure successfully reported as expected:', result.error);

    // Clean up all ephemeral test artifacts from database
    const freshDb = getDatabase();
    freshDb.mailboxes = freshDb.mailboxes.filter((m) => m.id !== brokenMailbox.id && m.id !== testMailbox?.id);
    freshDb.sendingJobs = freshDb.sendingJobs.filter((j) => !j.campaignId?.startsWith('camp-test-') && j.campaignId !== 'camp-fail-test');
    freshDb.failureReports = freshDb.failureReports.filter((f) => !f.campaignId?.startsWith('camp-test-') && f.campaignId !== 'camp-fail-test');
    freshDb.sendingEvents = freshDb.sendingEvents.filter((e) => !e.campaignId?.startsWith('camp-test-') && e.campaignId !== 'camp-fail-test');
    saveDatabase(freshDb);
  });
});
