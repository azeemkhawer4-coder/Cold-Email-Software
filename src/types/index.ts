export type LeadVerificationStatus = 'valid' | 'invalid' | 'risky' | 'catch_all' | 'unknown';
export type LeadStatus = 'new' | 'contacted' | 'replied' | 'interested' | 'meeting_booked' | 'unsubscribed' | 'bounced' | 'suppressed';

export interface Lead {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  jobTitle: string;
  company: string;
  website: string;
  domain: string;
  industry: string;
  country: string;
  state?: string;
  city: string;
  linkedinUrl: string;
  phone: string;
  companySize?: string;
  source: string;
  verificationStatus: LeadVerificationStatus;
  status: LeadStatus;
  assignedOwner: string;
  customFields: Record<string, string>;
  notes: string;
  tags: string[];
  dateAdded: string;
  lastContacted?: string;
  lastReply?: string;
  unsubscribeStatus: boolean;
  bounceStatus: boolean;
  campaignId?: string;
  listId?: string;
}

export interface LeadList {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  leadCount: number;
  tags: string[];
  type: 'static' | 'segment';
  filterCriteria?: Record<string, any>;
  createdAt: string;
}

export type StepType = 'email' | 'delay' | 'condition' | 'task';

export interface EmailVariant {
  id: string;
  name?: string;
  subject: string;
  body: string;
  weight: number; // percentage (e.g. 50)
  sentCount: number;
  replyCount: number;
}

export interface CampaignStep {
  id: string;
  campaignId: string;
  stepNumber: number;
  type: StepType;
  delayHours: number; // For delay step (e.g. 24, 48, 72)
  emailData?: {
    subject: string;
    body: string;
    variants: EmailVariant[];
  };
  conditionType?: 'if_replied' | 'if_opened' | 'if_clicked';
  yesStepNumber?: number; // Step number to advance to if condition is met
  noStepNumber?: number;  // Step number to advance to if condition is not met
  taskData?: {
    title: string;
    description: string;
  };
}

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled' | 'failed';

export interface CampaignSchedule {
  startDate: string;
  endDate?: string;
  sendingDays: number[]; // 1=Mon, 2=Tue, ..., 7=Sun
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  timezone: string;
  useRecipientTimezone: boolean;
  minIntervalSeconds: number;
}

export interface CampaignSettings {
  dailyLimit: number;
  maxNewLeadsPerDay: number;
  maxPerDomainPerDay: number;
  mailboxRotation: 'round_robin' | 'least_recently_used' | 'balanced';
  stopOnReply: boolean;
  stopOnUnsubscribe: boolean;
  trackOpens: boolean;
  trackClicks: boolean;
  plainTextOnly: boolean;
}

export interface CampaignStats {
  enrolled: number;
  sent: number;
  delivered: number;
  opened: number;
  replied: number;
  positiveReplies: number;
  bounced: number;
  unsubscribed: number;
  meetingsBooked: number;
  totalLeads?: number;
  sentCount?: number;
  deliveredCount?: number;
  openCount?: number;
  replyCount?: number;
  interestedCount?: number;
  meetingCount?: number;
  bounceCount?: number;
  unsubscribeCount?: number;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: CampaignStatus;
  leadListId: string;
  listId?: string;
  mailboxAccountIds: string[];
  schedule: CampaignSchedule;
  settings: CampaignSettings;
  steps: CampaignStep[];
  stats: CampaignStats;
  launchType?: 'immediate' | 'scheduled';
  scheduledStartAt?: string;
  launchedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type MailboxProvider = 'gmail' | 'outlook' | 'smtp';
export type MailboxStatus =
  | 'connected'
  | 'synchronizing'
  | 'sync_completed'
  | 'temporary_error'
  | 'reauth_required'
  | 'disconnected'
  | 'paused'
  | 'error';

export interface MailboxOAuthConfig {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  clientId?: string;
  clientSecret?: string;
  tenantId?: string; // For Microsoft Graph (common or tenant UUID)
}

export interface MailboxAccount {
  id: string;
  workspaceId: string;
  email: string;
  name: string;
  provider: MailboxProvider;
  status: MailboxStatus;
  dailyLimit: number;
  dailyQuota?: number;
  sentToday: number;
  warmupStatus: 'active' | 'paused' | 'disabled';
  warmupEnabled?: boolean;
  warmupDailyLimit?: number;
  warmupSentToday?: number;
  warmupRampupPerDay?: number;
  warmupTargetDaily?: number;
  reputationScore?: number;
  warmupScore: number;
  healthScore: number;
  signature: string;
  // SMTP settings
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  // IMAP settings for real reply synchronization
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPass?: string;
  imapSecure?: boolean;
  // OAuth settings & token refresh
  oauth?: MailboxOAuthConfig;
  lastError?: string;
  lastSyncAt: string;
  lastSentAt?: number;
  createdAt: string;
  updatedAt?: string;
  isTestMailbox?: boolean;
  previewUrl?: string;
}

export interface InboundMessage {
  id: string;
  sender: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  timestamp: string;
  isInbound: boolean;
}

export type ConversationCategory =
  | 'interested'
  | 'not_interested'
  | 'meeting_booked'
  | 'out_of_office'
  | 'unsubscribed'
  | 'question'
  | 'general';

export interface Conversation {
  id: string;
  workspaceId: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadCompany: string;
  campaignId: string;
  campaignName: string;
  mailboxId: string;
  mailboxEmail: string;
  subject: string;
  snippet: string;
  status: 'unread' | 'read' | 'archived';
  category: ConversationCategory;
  lastMessageAt: string;
  messages: InboundMessage[];
  assignedTo?: string;
  notes?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type DealStage =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'meeting_booked'
  | 'proposal_sent'
  | 'won'
  | 'lost';

export interface Deal {
  id: string;
  workspaceId: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadCompany: string;
  title: string;
  value: number;
  stage: DealStage;
  owner: string;
  meetingDate?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Automation {
  id: string;
  workspaceId: string;
  name: string;
  enabled: boolean;
  triggerEvent:
    | 'lead_created'
    | 'email_sent'
    | 'reply_received'
    | 'positive_reply'
    | 'bounce_detected'
    | 'unsubscribed'
    | 'deal_stage_changed';
  actionType:
    | 'add_tag'
    | 'update_lead_status'
    | 'move_deal_stage'
    | 'assign_owner'
    | 'create_task'
    | 'pause_campaign'
    | 'send_webhook';
  actionParams: Record<string, any>;
  executionCount: number;
  lastExecutedAt?: string;
}

export interface DeliverabilityAudit {
  domain: string;
  spf: { valid: boolean; record: string; description: string };
  dkim: { valid: boolean; selector: string; description: string };
  dmarc: { valid: boolean; record: string; policy: string; description: string };
  mx: { valid: boolean; records: string[]; description: string };
  overallScore: number; // 0-100
  status: 'excellent' | 'good' | 'warning' | 'critical';
  recommendations: string[];
}

export type SendingJobStatus =
  | 'queued'
  | 'scheduled'
  | 'processing'
  | 'sent'
  | 'retrying'
  | 'bounced'
  | 'failed'
  | 'cancelled';

export interface SendingJob {
  id: string;
  idempotencyKey: string;
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
  scheduledFor?: string;
  status: SendingJobStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt?: string;
  lastAttemptAt?: string;
  lastError?: string;
  errorDetails?: string;
  sentAt?: string;
  messageId?: string;
  sentMessageId?: string;
  variantId?: string;
  variantName?: string;
  previewUrl?: string; // Preview URL for test mailboxes (Ethereal)
  createdAt: string;
  updatedAt: string;
}

export type FailureType =
  | 'auth'
  | 'rate_limit'
  | 'smtp_connect'
  | 'bounce'
  | 'quota_exceeded'
  | 'network'
  | 'invalid_recipient'
  | 'unknown';

export interface FailureReport {
  id: string;
  jobId: string;
  idempotencyKey?: string;
  campaignId: string;
  campaignName: string;
  leadId: string;
  leadEmail: string;
  mailboxId: string;
  mailboxEmail: string;
  provider: string;
  errorType: FailureType;
  errorMessage: string;
  errorDetails?: string;
  timestamp: string;
  resolved: boolean;
}

export interface QueueStats {
  queued: number;
  scheduled: number;
  processing: number;
  sent: number;
  retrying: number;
  failed: number;
  total: number;
}

export interface SendingEvent {
  id: string;
  workspaceId: string;
  campaignId: string;
  leadId: string;
  mailboxId: string;
  eventType: 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced' | 'unsubscribed' | 'meeting_booked' | 'clicked';
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface WorkspaceSettings {
  id: string;
  name: string;
  ownerEmail: string;
  timezone: string;
  physicalAddress: string;
  unsubscribeFooter: string;
  companyName: string;
  complianceMode: 'gdpr' | 'canspam' | 'strict';
  globalSuppressionCount: number;
}

export interface Company {
  id: string;
  workspaceId?: string;
  name: string;
  domain: string;
  industry: string;
  leadCount?: number;
  leadsCount?: number;
  dealsCount?: number;
  totalValue?: number;
  employeeCount?: string;
  location?: string;
  phone?: string;
  linkedinUrl?: string;
  website?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Task {
  id: string;
  workspaceId?: string;
  title: string;
  description?: string;
  leadId?: string;
  leadName?: string;
  dealId?: string;
  dueDate: string;
  status: 'pending' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ZeroCostStatus {
  monthlyOperatingCost: number; // 0
  currency?: string;
  lifetimeFree?: boolean;
  databaseType?: 'sqlite' | 'json';
  sqlitePath?: string;
  databaseSizeKb?: number;
  freeMailboxesCount?: number;
  dailyFreeQuotaUsed?: number;
  dailyFreeQuotaLimit?: number;
  geminiFreeTierStatus?: 'active' | 'not_configured';
  storage?: {
    engine: string;
    type: string;
    path: string;
    sizeKb: number;
    isZeroCost: boolean;
    recordCounts: Record<string, number>;
  };
  freeEmailProviders?: {
    id: string;
    name: string;
    dailyQuota: string;
    cost: string;
    status: string;
    description: string;
  }[];
  freeAiTier?: {
    name: string;
    model: string;
    freeQuota: string;
    cost: string;
    status: string;
    description: string;
  };
  localFeatures?: {
    name: string;
    cost: string;
    status: string;
    note: string;
  }[];
  optionalServicesDisabled?: {
    name: string;
    status: string;
    cost: string;
    savings: string;
  }[];
  optionalServices?: {
    name: string;
    type: string;
    status: 'free_built_in' | 'optional_disabled' | 'optional_active';
    description: string;
  }[];
}
