import crypto from 'crypto';
import { Campaign, SendingEvent, SendingJob } from '../types';

// Standard 43-byte 1x1 transparent GIF
export const TRANSPARENT_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Generates an opaque tracking token without exposing internal IDs or tool names.
 */
export function generateTrackingToken(): string {
  return `t_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Validates whether a base URL is a publicly reachable HTTP(S) origin.
 * Localhost/loopback URLs are rejected because:
 * 1. Gmail/Outlook image proxies cannot fetch localhost:3000.
 * 2. Including http://localhost links in external emails triggers spam filters.
 */
export function isPublicTrackingUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the first valid, non-localhost public URL for open tracking pixels.
 */
export function resolveTrackingBaseUrl(
  workspaceTrackingUrl?: string | null,
  envPublicUrl?: string | null,
  requestOrigin?: string | null
): string | null {
  const candidates = [workspaceTrackingUrl, envPublicUrl, requestOrigin];
  for (const candidate of candidates) {
    if (isPublicTrackingUrl(candidate)) {
      return String(candidate).trim().replace(/\/+$/, '');
    }
  }
  return null;
}

/**
 * Builds the 1x1 open tracking pixel URL for a job token.
 */
export function buildOpenTrackingPixelUrl(baseUrl: string, trackingToken: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  return `${normalizedBase}/api/track/open/${encodeURIComponent(trackingToken)}.gif`;
}

export interface RecordOpenResult {
  matched: boolean;
  firstOpen: boolean;
  jobId?: string;
  campaignId?: string;
  leadId?: string;
  event?: SendingEvent;
}

/**
 * Records an open tracking hit against SQLite state with unique-open deduplication.
 * Repeated opens (or email client proxy pre-fetches) increment job.openCount
 * without inflating campaign.stats.opened above 1 unique open per sent message.
 */
export function recordOpenEventForState(params: {
  tokenOrJobId: string;
  workspaceId: string;
  sendingJobs: SendingJob[];
  campaigns: Campaign[];
  sendingEvents: SendingEvent[];
  userAgent?: string;
  nowIso?: string;
}): RecordOpenResult {
  const {
    tokenOrJobId,
    workspaceId,
    sendingJobs,
    campaigns,
    sendingEvents,
    userAgent,
    nowIso = new Date().toISOString(),
  } = params;

  const cleanToken = String(tokenOrJobId || '').replace(/\.gif$/i, '').trim();
  if (!cleanToken) {
    return { matched: false, firstOpen: false };
  }

  const job = sendingJobs.find(
    (j) => j.trackingToken === cleanToken || j.id === cleanToken
  );

  if (!job) {
    return { matched: false, firstOpen: false };
  }

  const wasOpenedBefore = Boolean(job.openedAt || (job.openCount && job.openCount > 0));
  job.openCount = (job.openCount || 0) + 1;
  if (!job.openedAt) {
    job.openedAt = nowIso;
  }
  job.lastOpenedAt = nowIso;
  job.updatedAt = nowIso;

  const event: SendingEvent = {
    id: `evt-open-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: job.workspaceId || workspaceId,
    campaignId: job.campaignId,
    leadId: job.leadId,
    mailboxId: job.mailboxId,
    eventType: 'opened',
    timestamp: nowIso,
    metadata: {
      jobId: job.id,
      stepId: job.stepId,
      variantId: job.variantId,
      isUniqueOpen: !wasOpenedBefore,
      userAgent: userAgent ? userAgent.slice(0, 180) : undefined,
    },
  };
  sendingEvents.push(event);

  if (!wasOpenedBefore) {
    const campaign = campaigns.find((c) => c.id === job.campaignId);
    if (campaign) {
      if (!campaign.stats) {
        campaign.stats = {
          enrolled: 0,
          sent: 0,
          delivered: 0,
          opened: 0,
          replied: 0,
          positiveReplies: 0,
          bounced: 0,
          unsubscribed: 0,
          meetingsBooked: 0,
        };
      }
      campaign.stats.opened = (campaign.stats.opened || 0) + 1;

      if (job.variantId) {
        const step = campaign.steps?.find(
          (s) => s.id === job.stepId || s.stepNumber === job.stepNumber
        );
        const variant = step?.emailData?.variants?.find((v) => v.id === job.variantId);
        if (variant) {
          variant.openCount = (variant.openCount || 0) + 1;
        }
      }
    }
  }

  return {
    matched: true,
    firstOpen: !wasOpenedBefore,
    jobId: job.id,
    campaignId: job.campaignId,
    leadId: job.leadId,
    event,
  };
}
