import { getDatabase, saveDatabase } from './db';
import { SendingJob, FailureReport, FailureType, QueueStats } from '../types';

/**
 * Creates a deterministic, collision-resistant idempotency key
 */
export function generateIdempotencyKey(campaignId: string, stepId: string, leadId: string): string {
  return `ik_${campaignId}_${stepId}_${leadId}`;
}

/**
 * Calculates exponential backoff for retrying transient delivery failures
 * Attempt 1: 1 min, Attempt 2: 5 min, Attempt 3: 15 min
 */
export function calcNextAttemptTime(attempts: number, baseMinutes = 1): string {
  const delays = [1, 5, 15, 60];
  const delayMin = delays[Math.min(attempts - 1, delays.length - 1)] || baseMinutes * Math.pow(2, attempts);
  const nextTime = new Date(Date.now() + delayMin * 60 * 1000);
  return nextTime.toISOString();
}

/**
 * Enqueues an email job into the durable outbox queue with idempotency protection
 */
export function enqueueJob(
  jobData: {
    workspaceId: string;
    campaignId: string;
    campaignName?: string;
    leadId: string;
    leadEmail: string;
    leadName?: string;
    mailboxId: string;
    mailboxEmail?: string;
    stepId: string;
    stepNumber: number;
    subject: string;
    body: string;
    scheduledAt: string;
    maxAttempts?: number;
    idempotencyKey?: string;
    variantId?: string;
    variantName?: string;
    trackingToken?: string;
    trackOpens?: boolean;
    plainTextOnly?: boolean;
    includeComplianceFooter?: boolean;
  }
): { job: SendingJob; isDuplicate: boolean } {
  const db = getDatabase();
  const idempotencyKey =
    jobData.idempotencyKey || generateIdempotencyKey(jobData.campaignId, jobData.stepId, jobData.leadId);

  // Check for existing job with same idempotency key
  const existing = db.sendingJobs.find((j) => j.idempotencyKey === idempotencyKey);
  if (existing) {
    // If it was already sent, processing, or scheduled, do not re-enqueue
    return { job: existing, isDuplicate: true };
  }

  const now = new Date().toISOString();
  const newJob: SendingJob = {
    id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    idempotencyKey,
    workspaceId: jobData.workspaceId,
    campaignId: jobData.campaignId,
    campaignName: jobData.campaignName,
    leadId: jobData.leadId,
    leadEmail: jobData.leadEmail.toLowerCase(),
    leadName: jobData.leadName,
    mailboxId: jobData.mailboxId,
    mailboxEmail: jobData.mailboxEmail,
    stepId: jobData.stepId,
    stepNumber: jobData.stepNumber,
    subject: jobData.subject,
    body: jobData.body,
    variantId: jobData.variantId,
    variantName: jobData.variantName,
    trackingToken: jobData.trackingToken,
    trackOpens: jobData.trackOpens,
    plainTextOnly: jobData.plainTextOnly,
    includeComplianceFooter: jobData.includeComplianceFooter,
    openCount: 0,
    scheduledAt: jobData.scheduledAt,
    status: 'queued',
    attempts: 0,
    maxAttempts: jobData.maxAttempts || 3,
    createdAt: now,
    updatedAt: now,
  };

  db.sendingJobs.push(newJob);
  saveDatabase(db);

  return { job: newJob, isDuplicate: false };
}

/**
 * Returns all jobs that are due for delivery now
 */
export function getDueJobs(cutoffTime: Date = new Date()): SendingJob[] {
  const db = getDatabase();
  const cutoffIso = cutoffTime.toISOString();

  return db.sendingJobs.filter((job) => {
    if (job.status === 'queued') {
      return job.scheduledAt <= cutoffIso;
    }
    if (job.status === 'retrying') {
      return job.nextAttemptAt ? job.nextAttemptAt <= cutoffIso : true;
    }
    return false;
  });
}

/**
 * Atomically marks a job as 'processing'
 */
export function markJobProcessing(jobId: string): SendingJob | null {
  const db = getDatabase();
  const job = db.sendingJobs.find((j) => j.id === jobId);
  if (!job) return null;

  job.status = 'processing';
  job.updatedAt = new Date().toISOString();
  saveDatabase(db);
  return job;
}

/**
 * Marks a job as 'sent' and logs delivery metrics
 */
export function markJobSent(
  jobId: string,
  messageId: string,
  previewUrl?: string
): SendingJob | null {
  const db = getDatabase();
  const job = db.sendingJobs.find((j) => j.id === jobId);
  if (!job) return null;

  const now = new Date().toISOString();
  job.status = 'sent';
  job.attempts++;
  job.messageId = messageId;
  job.sentAt = now;
  job.previewUrl = previewUrl;
  job.lastError = undefined;
  job.updatedAt = now;

  saveDatabase(db);
  return job;
}

/**
 * Handles job failure with retry backoff or terminal failure reporting
 */
export function markJobFailed(
  jobId: string,
  error: string,
  errorDetails?: string,
  failureType: FailureType = 'unknown',
  providerName = 'unknown'
): { job: SendingJob; report?: FailureReport } {
  const db = getDatabase();
  const job = db.sendingJobs.find((j) => j.id === jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const now = new Date().toISOString();
  job.attempts++;
  job.lastError = error;
  job.errorDetails = errorDetails;
  job.updatedAt = now;

  // Fatal errors that must never be retried
  const isFatal =
    failureType === 'bounce' ||
    failureType === 'invalid_recipient' ||
    (failureType === 'auth' && job.attempts >= 2);

  let report: FailureReport | undefined;

  if (isFatal || job.attempts >= job.maxAttempts) {
    job.status = 'failed';

    report = {
      id: `fail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      jobId: job.id,
      idempotencyKey: job.idempotencyKey,
      campaignId: job.campaignId,
      campaignName: job.campaignName || 'Campaign',
      leadId: job.leadId,
      leadEmail: job.leadEmail,
      mailboxId: job.mailboxId,
      mailboxEmail: job.mailboxEmail || 'unknown',
      provider: providerName,
      errorType: failureType,
      errorMessage: error,
      errorDetails,
      timestamp: now,
      resolved: false,
    };

    db.failureReports.unshift(report);

    db.auditLogs.unshift({
      id: `log-${Date.now()}`,
      action: 'DELIVERY_FAILURE_PERMANENT',
      details: `Permanent delivery failure for ${job.leadEmail} via ${providerName} (${failureType}): ${error}`,
      timestamp: now,
    });
  } else {
    // Retryable with exponential backoff
    job.status = 'retrying';
    job.nextAttemptAt = calcNextAttemptTime(job.attempts);

    db.auditLogs.unshift({
      id: `log-${Date.now()}`,
      action: 'DELIVERY_RETRY_SCHEDULED',
      details: `Delivery attempt ${job.attempts}/${job.maxAttempts} failed for ${job.leadEmail} (${failureType}). Retrying at ${job.nextAttemptAt}`,
      timestamp: now,
    });
  }

  saveDatabase(db);
  return { job, report };
}

/**
 * Returns current statistics of the durable queue
 */
export function getQueueStats(): QueueStats {
  const db = getDatabase();
  const jobs = db.sendingJobs;

  return {
    queued: jobs.filter((j) => j.status === 'queued').length,
    scheduled: jobs.filter((j) => j.status === 'scheduled').length,
    processing: jobs.filter((j) => j.status === 'processing').length,
    sent: jobs.filter((j) => j.status === 'sent').length,
    retrying: jobs.filter((j) => j.status === 'retrying').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
    total: jobs.length,
  };
}
