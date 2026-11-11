import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getSqlitePath, resolveDataDir, getLegacyDbPath } from './paths';
import { runMigrations } from './migrations';
import { encryptSecret, decryptSecret } from './crypto';
import {
  Lead,
  LeadList,
  Campaign,
  MailboxAccount,
  Conversation,
  Deal,
  Automation,
  SendingJob,
  FailureReport,
  SendingEvent,
  WorkspaceSettings,
  Company,
  Task,
} from '../../types';

export interface DatabaseSchema {
  workspace: WorkspaceSettings;
  leads: Lead[];
  companies: Company[];
  lists: LeadList[];
  campaigns: Campaign[];
  mailboxes: MailboxAccount[];
  conversations: Conversation[];
  deals: Deal[];
  tasks: Task[];
  automations: Automation[];
  sendingJobs: SendingJob[];
  failureReports: FailureReport[];
  sendingEvents: SendingEvent[];
  suppressionList: { email: string; reason: string; addedAt: string }[];
  auditLogs: { id: string; action: string; details: string; timestamp: string }[];
}

let dbInstance: Database.Database | null = null;
let dbCache: DatabaseSchema | null = null;

/**
 * Initializes and returns the singleton better-sqlite3 database connection.
 * Configured with WAL mode, foreign keys, busy timeout, and automated migrations.
 */
export function getSqliteDatabase(): Database.Database {
  if (dbInstance) return dbInstance;

  const sqlitePath = getSqlitePath();

  try {
    const db = new Database(sqlitePath);

    // Configure SQLite for high performance and durability
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');

    // Execute SQL migrations
    runMigrations(db);

    dbInstance = db;
    return dbInstance;
  } catch (err: any) {
    if (err?.code === 'SQLITE_CORRUPT' || err?.message?.includes('malformed')) {
      console.warn('[SQLite] Malformed or corrupt database detected. Auto-recovering clean database file...');
      try {
        if (fs.existsSync(sqlitePath)) {
          fs.renameSync(sqlitePath, `${sqlitePath}.corrupt-${Date.now()}`);
        }
        if (fs.existsSync(`${sqlitePath}-wal`)) fs.rmSync(`${sqlitePath}-wal`, { force: true });
        if (fs.existsSync(`${sqlitePath}-shm`)) fs.rmSync(`${sqlitePath}-shm`, { force: true });
      } catch (_) {}

      const cleanDb = new Database(sqlitePath);
      cleanDb.pragma('journal_mode = WAL');
      cleanDb.pragma('foreign_keys = ON');
      cleanDb.pragma('busy_timeout = 5000');
      cleanDb.pragma('synchronous = NORMAL');

      runMigrations(cleanDb);
      dbInstance = cleanDb;
      return dbInstance;
    }
    throw err;
  }
}

/**
 * Reopens database connection (used during backup restore)
 */
export function reopenDatabase(): Database.Database {
  if (dbInstance) {
    try { dbInstance.close(); } catch (_) {}
    dbInstance = null;
  }
  dbCache = null;
  return getSqliteDatabase();
}

/**
 * Creates seed records if the workspace table is empty
 */
function seedInitialDataIfEmpty(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as count FROM workspaces').get() as { count: number };
  if (count.count > 0) return;

  console.log('[SQLite] Fresh database detected. Seeding initial OutboundOS data...');

  const workspace: WorkspaceSettings = {
    id: 'ws-apex-01',
    name: 'Apex Growth Labs',
    companyName: 'Apex Growth Technologies Inc.',
    ownerEmail: 'azeemkhawer4@gmail.com',
    timezone: 'America/Los_Angeles',
    physicalAddress: '548 Market St, Suite 39201, San Francisco, CA 94104',
    unsubscribeFooter: 'You received this email because we identified synergy with your role. If you prefer not to receive future updates, click here to unsubscribe.',
    complianceMode: 'strict',
    globalSuppressionCount: 2,
  };

  const now = new Date().toISOString();

  // 1. Workspace
  db.prepare(`
    INSERT INTO workspaces (id, name, company_name, owner_email, timezone, physical_address, unsubscribe_footer, compliance_mode, global_suppression_count, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    workspace.id,
    workspace.name,
    workspace.companyName,
    workspace.ownerEmail,
    workspace.timezone,
    workspace.physicalAddress,
    workspace.unsubscribeFooter,
    workspace.complianceMode,
    workspace.globalSuppressionCount,
    JSON.stringify(workspace),
    now
  );

  // 2. Default List
  db.prepare(`
    INSERT INTO lists (id, workspace_id, name, description, lead_count, tags, type, data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'list-saas-founders',
    workspace.id,
    'High-Growth SaaS VP & Directors',
    'Validated VP Engineering & Product leads from Series A-C SaaS tech firms',
    8,
    JSON.stringify(['B2B', 'SaaS', 'Decision-Maker']),
    'static',
    JSON.stringify({}),
    now
  );

  // 3. Initial Sample Leads
  const initialLeads: Lead[] = [
    {
      id: 'lead-1',
      workspaceId: workspace.id,
      firstName: 'Sarah',
      lastName: 'Chen',
      fullName: 'Sarah Chen',
      email: 'sarah.chen@datadoghq.com',
      jobTitle: 'VP of Platform Engineering',
      company: 'Datadog',
      website: 'datadoghq.com',
      domain: 'datadoghq.com',
      industry: 'Cloud Infrastructure & DevOps',
      country: 'United States',
      city: 'New York',
      linkedinUrl: 'https://linkedin.com/in/sarahchen-datadog',
      phone: '+1 415-555-0192',
      companySize: '5,000+ employees',
      source: 'CSV Upload',
      verificationStatus: 'valid',
      status: 'interested',
      assignedOwner: 'Azeem Khawer',
      customFields: { tech_stack: 'Kubernetes, AWS', quarterly_priority: 'Infrastructure Cost Optimization' },
      notes: 'Replied positively asking for a 15-minute demo next Tuesday.',
      tags: ['Enterprise', 'High Priority', 'Warm Reply'],
      dateAdded: now,
      lastContacted: now,
      lastReply: now,
      unsubscribeStatus: false,
      bounceStatus: false,
      listId: 'list-saas-founders',
      campaignId: 'camp-q4-enterprise',
    },
    {
      id: 'lead-2',
      workspaceId: workspace.id,
      firstName: 'Marcus',
      lastName: 'Vance',
      fullName: 'Marcus Vance',
      email: 'm.vance@stripe.com',
      jobTitle: 'Head of Developer Experience',
      company: 'Stripe',
      website: 'stripe.com',
      domain: 'stripe.com',
      industry: 'Financial Technology',
      country: 'United States',
      city: 'San Francisco',
      linkedinUrl: 'https://linkedin.com/in/marcusvance-stripe',
      phone: '+1 415-555-0143',
      companySize: '8,000+ employees',
      source: 'Domain Prospecting',
      verificationStatus: 'valid',
      status: 'meeting_booked',
      assignedOwner: 'Azeem Khawer',
      customFields: { tech_stack: 'Ruby, Go, Envoy', quarterly_priority: 'Developer Tooling' },
      notes: 'Meeting booked for Thursday 2pm PST.',
      tags: ['Enterprise', 'FinTech', 'Demo Scheduled'],
      dateAdded: now,
      lastContacted: now,
      lastReply: now,
      unsubscribeStatus: false,
      bounceStatus: false,
      listId: 'list-saas-founders',
      campaignId: 'camp-q4-enterprise',
    },
  ];

  const insertLead = db.prepare(`
    INSERT INTO leads (id, workspace_id, list_id, campaign_id, email, first_name, last_name, full_name, company, job_title, domain, phone, linkedin_url, status, verification_status, unsubscribe_status, bounce_status, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const l of initialLeads) {
    insertLead.run(
      l.id,
      l.workspaceId,
      l.listId || null,
      l.campaignId || null,
      l.email,
      l.firstName,
      l.lastName,
      l.fullName,
      l.company,
      l.jobTitle,
      l.domain,
      l.phone || null,
      l.linkedinUrl || null,
      l.status,
      l.verificationStatus,
      l.unsubscribeStatus ? 1 : 0,
      l.bounceStatus ? 1 : 0,
      JSON.stringify(l),
      now,
      now
    );
  }

  // 4. Initial Companies
  const initialCompanies: Company[] = [
    {
      id: 'comp-1',
      name: 'Stripe',
      domain: 'stripe.com',
      industry: 'Financial Technology',
      employeeCount: '8,000+',
      location: 'San Francisco, CA',
      website: 'https://stripe.com',
      leadsCount: 1,
      dealsCount: 1,
      totalValue: 36000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'comp-2',
      name: 'Datadog',
      domain: 'datadoghq.com',
      industry: 'Cloud Monitoring',
      employeeCount: '5,000+',
      location: 'New York, NY',
      website: 'https://datadoghq.com',
      leadsCount: 1,
      dealsCount: 1,
      totalValue: 48000,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const insertComp = db.prepare(`
    INSERT INTO companies (id, workspace_id, name, domain, industry, employee_count, location, website, leads_count, deals_count, total_value, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of initialCompanies) {
    insertComp.run(
      c.id,
      workspace.id,
      c.name,
      c.domain,
      c.industry,
      c.employeeCount || '50-200',
      c.location || 'United States',
      c.website || '',
      c.leadsCount || 0,
      c.dealsCount || 0,
      c.totalValue || 0,
      JSON.stringify(c),
      now,
      now
    );
  }

  // 5. Initial Campaign
  const sampleCampaign: Campaign = {
    id: 'camp-q4-enterprise',
    workspaceId: workspace.id,
    name: 'Q4 Enterprise SaaS — Platform Infrastructure',
    description: 'Outbound sequence for enterprise SaaS infrastructure leaders',
    status: 'active',
    leadListId: 'list-saas-founders',
    listId: 'list-saas-founders',
    mailboxAccountIds: ['mb-primary-google', 'mb-custom-smtp'],
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
    stats: {
      enrolled: 2,
      sent: 2,
      delivered: 2,
      opened: 2,
      replied: 2,
      positiveReplies: 1,
      bounced: 0,
      unsubscribed: 0,
      meetingsBooked: 1,
      totalLeads: 2,
      sentCount: 2,
      deliveredCount: 2,
      openCount: 2,
      replyCount: 2,
      interestedCount: 1,
      meetingCount: 1,
      bounceCount: 0,
      unsubscribeCount: 0,
    },
    schedule: {
      startDate: now.split('T')[0],
      sendingDays: [1, 2, 3, 4, 5],
      startTime: '08:30',
      endTime: '17:30',
      timezone: 'America/Los_Angeles',
      minIntervalSeconds: 60,
      useRecipientTimezone: true,
    },
    steps: [
      {
        id: 'step-1',
        campaignId: 'camp-q4-enterprise',
        stepNumber: 1,
        type: 'email',
        delayHours: 0,
        emailData: {
          subject: 'Quick question about {{company}} infrastructure',
          body: 'Hi {{first_name}},\n\nI noticed you oversee engineering initiatives at {{company}}.\n\nWe recently helped several engineering teams cut multi-cloud egress overhead by 34%.\n\nWould you be open to a 10-minute exchange this Thursday?\n\nBest,\nAzeem',
          variants: [
            {
              id: 'var-1',
              subject: 'Quick question about {{company}} infrastructure',
              body: 'Hi {{first_name}},\n\nI noticed you oversee engineering initiatives at {{company}}.\n\nWe recently helped several engineering teams cut multi-cloud egress overhead by 34%.\n\nWould you be open to a 10-minute exchange this Thursday?\n\nBest,\nAzeem',
              weight: 100,
              sentCount: 2,
              replyCount: 2,
            },
          ],
        },
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(`
    INSERT INTO campaigns (id, workspace_id, list_id, name, status, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sampleCampaign.id,
    sampleCampaign.workspaceId,
    sampleCampaign.listId,
    sampleCampaign.name,
    sampleCampaign.status,
    JSON.stringify(sampleCampaign),
    now,
    now
  );

  // 6. Initial Mailboxes
  const sampleMailbox: MailboxAccount = {
    id: 'mb-primary-google',
    workspaceId: workspace.id,
    name: 'Azeem Khawer (Workspace)',
    email: 'azeem@apexoutbound.io',
    provider: 'gmail',
    status: 'connected',
    dailyLimit: 50,
    dailyQuota: 50,
    sentToday: 2,
    warmupStatus: 'active',
    warmupScore: 98,
    healthScore: 98,
    signature: '',
    lastSyncAt: now,
    warmupEnabled: true,
    warmupDailyLimit: 20,
    warmupSentToday: 4,
    warmupRampupPerDay: 2,
    warmupTargetDaily: 35,
    reputationScore: 98,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(`
    INSERT INTO email_accounts (id, workspace_id, email, name, provider, status, daily_quota, sent_today, daily_warmup_limit, warmup_sent_today, warmup_enabled, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sampleMailbox.id,
    sampleMailbox.workspaceId,
    sampleMailbox.email,
    sampleMailbox.name,
    sampleMailbox.provider,
    sampleMailbox.status,
    sampleMailbox.dailyQuota,
    sampleMailbox.sentToday,
    sampleMailbox.warmupDailyLimit || 20,
    sampleMailbox.warmupSentToday || 0,
    sampleMailbox.warmupEnabled ? 1 : 0,
    JSON.stringify(sampleMailbox),
    now,
    now
  );

  // 7. Initial Tasks
  const initialTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Review inbound reply from Sarah Chen (Datadog)',
      description: 'Prepare benchmark PDF and calendar link for Tuesday 10am demo.',
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      priority: 'high',
      status: 'pending',
      assignedTo: 'Azeem Khawer',
      leadId: 'lead-1',
      leadName: 'Sarah Chen',
      createdAt: now,
      updatedAt: now,
    },
  ];

  db.prepare(`
    INSERT INTO tasks (id, workspace_id, lead_id, title, description, due_date, status, priority, assigned_to, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    initialTasks[0].id,
    workspace.id,
    initialTasks[0].leadId || null,
    initialTasks[0].title,
    initialTasks[0].description || '',
    initialTasks[0].dueDate,
    initialTasks[0].status,
    initialTasks[0].priority,
    initialTasks[0].assignedTo || 'Admin',
    JSON.stringify(initialTasks[0]),
    now,
    now
  );

  // 8. Initial Deals
  const initialDeals: Deal[] = [
    {
      id: 'deal-datadog-1',
      workspaceId: workspace.id,
      leadId: 'lead-1',
      leadName: 'Sarah Chen',
      leadEmail: 'sarah.chen@datadoghq.com',
      leadCompany: 'Datadog',
      title: 'Datadog — Platform Infrastructure License',
      value: 48000,
      stage: 'interested',
      owner: 'Azeem Khawer',
      meetingDate: '2026-11-17T18:00:00.000Z',
      notes: 'Demo scheduled with VP Platform Engineering.',
      createdAt: now,
      updatedAt: now,
    },
  ];

  db.prepare(`
    INSERT INTO deals (id, workspace_id, lead_id, title, value, stage, owner, meeting_date, notes, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    initialDeals[0].id,
    workspace.id,
    initialDeals[0].leadId || null,
    initialDeals[0].title,
    initialDeals[0].value,
    initialDeals[0].stage,
    initialDeals[0].owner || 'Admin',
    initialDeals[0].meetingDate || null,
    initialDeals[0].notes || '',
    JSON.stringify(initialDeals[0]),
    now,
    now
  );

  console.log('[SQLite] Seeded initial workspace, lists, leads, companies, campaign, mailbox, tasks, and deals.');
}

/**
 * Returns complete database schema loaded directly from SQLite tables
 */
export function getDatabase(): DatabaseSchema {
  if (dbCache) return dbCache;

  const db = getSqliteDatabase();
  seedInitialDataIfEmpty(db);

  try {
    // 1. Workspace
    const wsRow = db.prepare('SELECT data FROM workspaces LIMIT 1').get() as { data: string } | undefined;
    const workspace: WorkspaceSettings = wsRow ? JSON.parse(wsRow.data) : {
      id: 'ws-apex-01',
      name: 'Apex Growth Labs',
      companyName: 'Apex Growth Technologies Inc.',
      ownerEmail: 'azeemkhawer4@gmail.com',
      timezone: 'America/Los_Angeles',
      physicalAddress: '548 Market St, San Francisco, CA',
      unsubscribeFooter: 'Click here to unsubscribe.',
      complianceMode: 'strict',
      globalSuppressionCount: 0,
    };

    // 2. Leads
    const leadRows = db.prepare('SELECT data FROM leads ORDER BY created_at DESC').all() as { data: string }[];
    const leads: Lead[] = leadRows.map((r) => JSON.parse(r.data));

    // 3. Companies
    const compRows = db.prepare('SELECT data FROM companies ORDER BY name ASC').all() as { data: string }[];
    const companies: Company[] = compRows.map((r) => JSON.parse(r.data));

    // 4. Lists
    const listRows = db.prepare('SELECT * FROM lists ORDER BY created_at DESC').all() as any[];
    const lists: LeadList[] = listRows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      description: r.description,
      leadCount: r.lead_count,
      tags: r.tags ? JSON.parse(r.tags) : [],
      type: r.type,
      createdAt: r.created_at,
    }));

    // 5. Campaigns
    const campRows = db.prepare('SELECT data FROM campaigns ORDER BY created_at DESC').all() as { data: string }[];
    const campaigns: Campaign[] = campRows.map((r) => JSON.parse(r.data));

    // 6. Mailboxes
    const mbRows = db.prepare('SELECT data FROM email_accounts ORDER BY created_at DESC').all() as { data: string }[];
    const mailboxes: MailboxAccount[] = mbRows.map((r) => JSON.parse(r.data));

    // 7. Conversations
    const convRows = db.prepare('SELECT data FROM conversations ORDER BY last_message_at DESC').all() as { data: string }[];
    const conversations: Conversation[] = convRows.map((r) => JSON.parse(r.data));

    // 8. Deals
    const dealRows = db.prepare('SELECT data FROM deals ORDER BY created_at DESC').all() as { data: string }[];
    const deals: Deal[] = dealRows.map((r) => JSON.parse(r.data));

    // 9. Tasks
    const taskRows = db.prepare('SELECT data FROM tasks ORDER BY due_date ASC').all() as { data: string }[];
    const tasks: Task[] = taskRows.map((r) => JSON.parse(r.data));

    // 10. Automations
    const autoRows = db.prepare('SELECT data FROM automations ORDER BY created_at DESC').all() as { data: string }[];
    const automations: Automation[] = autoRows.map((r) => JSON.parse(r.data));

    // 11. Sending Jobs
    const jobRows = db.prepare('SELECT data FROM sending_jobs ORDER BY scheduled_for ASC').all() as { data: string }[];
    const sendingJobs: SendingJob[] = jobRows.map((r) => JSON.parse(r.data));

    // 12. Suppressions
    const suppRows = db.prepare('SELECT email, reason, created_at as addedAt FROM suppression_records').all() as any[];

    // 13. Audit logs
    const auditRows = db.prepare('SELECT id, action, details_json as details, created_at as timestamp FROM audit_logs ORDER BY created_at DESC LIMIT 100').all() as any[];

    dbCache = {
      workspace,
      leads,
      companies,
      lists,
      campaigns,
      mailboxes,
      conversations,
      deals,
      tasks,
      automations,
      sendingJobs,
      failureReports: [],
      sendingEvents: [],
      suppressionList: suppRows,
      auditLogs: auditRows,
    };

    return dbCache;
  } catch (err: any) {
    console.error('[SQLite] Error reading database:', err);
    throw err;
  }
}

/**
 * Saves and synchronizes entire database schema into normalized SQLite tables
 * using a single, ACID-compliant SQLite transaction.
 */
export function saveDatabase(data: DatabaseSchema): void {
  const db = getSqliteDatabase();
  const now = new Date().toISOString();

  const syncTx = db.transaction(() => {
    // 1. Workspace
    db.prepare(`
      INSERT OR REPLACE INTO workspaces (id, name, company_name, owner_email, timezone, physical_address, unsubscribe_footer, compliance_mode, global_suppression_count, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.workspace.id,
      data.workspace.name,
      data.workspace.companyName,
      data.workspace.ownerEmail,
      data.workspace.timezone,
      data.workspace.physicalAddress,
      data.workspace.unsubscribeFooter,
      data.workspace.complianceMode,
      data.suppressionList.length,
      JSON.stringify(data.workspace),
      now
    );

    // 2. Leads
    const upsertLead = db.prepare(`
      INSERT OR REPLACE INTO leads (id, workspace_id, list_id, campaign_id, email, first_name, last_name, full_name, company, job_title, domain, phone, linkedin_url, status, verification_status, unsubscribe_status, bounce_status, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of data.leads) {
      upsertLead.run(
        l.id,
        data.workspace.id,
        l.listId || null,
        l.campaignId || null,
        l.email,
        l.firstName,
        l.lastName,
        l.fullName,
        l.company,
        l.jobTitle,
        l.domain,
        l.phone || null,
        l.linkedinUrl || null,
        l.status || 'new',
        l.verificationStatus || 'unverified',
        l.unsubscribeStatus ? 1 : 0,
        l.bounceStatus ? 1 : 0,
        JSON.stringify(l),
        l.dateAdded || now,
        now
      );
    }

    // 3. Companies
    if (Array.isArray(data.companies)) {
      const upsertCompany = db.prepare(`
        INSERT OR REPLACE INTO companies (id, workspace_id, name, domain, industry, employee_count, location, website, leads_count, deals_count, total_value, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of data.companies) {
        upsertCompany.run(
          c.id,
          data.workspace.id,
          c.name,
          c.domain,
          c.industry,
          c.employeeCount || '50-200',
          c.location || 'United States',
          c.website || '',
          c.leadsCount || 0,
          c.dealsCount || 0,
          c.totalValue || 0,
          JSON.stringify(c),
          c.createdAt || now,
          now
        );
      }
    }

    // 4. Campaigns
    if (Array.isArray(data.campaigns)) {
      const upsertCamp = db.prepare(`
        INSERT OR REPLACE INTO campaigns (id, workspace_id, list_id, name, status, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of data.campaigns) {
        upsertCamp.run(c.id, data.workspace.id, c.listId || null, c.name, c.status, JSON.stringify(c), c.createdAt || now, now);
      }
    }

    // 5. Mailboxes
    if (Array.isArray(data.mailboxes)) {
      const upsertMb = db.prepare(`
        INSERT OR REPLACE INTO email_accounts (id, workspace_id, email, name, provider, status, daily_quota, sent_today, daily_warmup_limit, warmup_sent_today, warmup_enabled, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const m of data.mailboxes) {
        upsertMb.run(
          m.id,
          data.workspace.id,
          m.email,
          m.name,
          m.provider,
          m.status,
          m.dailyQuota,
          m.sentToday,
          m.warmupDailyLimit || 20,
          m.warmupSentToday || 0,
          m.warmupEnabled ? 1 : 0,
          JSON.stringify(m),
          m.createdAt || now,
          now
        );
      }
    }

    // 6. Sending Jobs
    if (Array.isArray(data.sendingJobs)) {
      const upsertJob = db.prepare(`
        INSERT OR REPLACE INTO sending_jobs (id, campaign_id, step_id, lead_id, mailbox_id, scheduled_for, status, attempts, max_attempts, last_attempt_at, last_error, idempotency_key, sent_message_id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const j of data.sendingJobs) {
        upsertJob.run(
          j.id,
          j.campaignId,
          j.stepId,
          j.leadId,
          j.mailboxId || null,
          j.scheduledFor || now,
          j.status || 'queued',
          j.attempts || 0,
          j.maxAttempts || 5,
          j.lastAttemptAt || null,
          j.lastError || null,
          j.idempotencyKey,
          j.sentMessageId || null,
          JSON.stringify(j),
          j.createdAt || now,
          now
        );
      }
    }

    // 7. Tasks
    if (Array.isArray(data.tasks)) {
      const upsertTask = db.prepare(`
        INSERT OR REPLACE INTO tasks (id, workspace_id, lead_id, deal_id, title, description, due_date, status, priority, assigned_to, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const t of data.tasks) {
        upsertTask.run(
          t.id,
          data.workspace.id,
          t.leadId || null,
          t.dealId || null,
          t.title,
          t.description || '',
          t.dueDate,
          t.status,
          t.priority,
          t.assignedTo || 'Admin',
          JSON.stringify(t),
          t.createdAt || now,
          now
        );
      }
    }

    // 8. Deals
    if (Array.isArray(data.deals)) {
      const upsertDeal = db.prepare(`
        INSERT OR REPLACE INTO deals (id, workspace_id, lead_id, title, value, stage, owner, meeting_date, notes, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const d of data.deals) {
        upsertDeal.run(
          d.id,
          data.workspace.id,
          d.leadId || null,
          d.title,
          d.value,
          d.stage,
          d.owner || 'Admin',
          d.meetingDate || null,
          d.notes || '',
          JSON.stringify(d),
          d.createdAt || now,
          now
        );
      }
    }

    // 9. Conversations
    if (Array.isArray(data.conversations)) {
      const upsertConv = db.prepare(`
        INSERT OR REPLACE INTO conversations (id, workspace_id, lead_id, lead_email, lead_name, lead_company, campaign_id, mailbox_id, mailbox_email, subject, status, category, last_message_at, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of data.conversations) {
        upsertConv.run(
          c.id,
          data.workspace.id,
          c.leadId,
          c.leadEmail,
          c.leadName || '',
          c.leadCompany || '',
          c.campaignId || null,
          c.mailboxId || null,
          c.mailboxEmail || null,
          c.subject,
          c.status || 'read',
          c.category || 'general',
          c.lastMessageAt || now,
          JSON.stringify(c),
          c.createdAt || now,
          now
        );
      }
    }

    // 10. Suppressions
    if (Array.isArray(data.suppressionList)) {
      const upsertSupp = db.prepare(`
        INSERT OR REPLACE INTO suppression_records (id, workspace_id, email, reason, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const s of data.suppressionList) {
        upsertSupp.run(
          `supp-${s.email}`,
          data.workspace.id,
          s.email.toLowerCase().trim(),
          s.reason || 'Unsubscribe',
          'auto',
          s.addedAt || now
        );
      }
    }
  });

  try {
    syncTx();
    dbCache = data;
  } catch (err: any) {
    console.error('[SQLite] Transaction failed during saveDatabase:', err);
  }
}

/**
 * Returns SQLite storage and database statistics
 */
export function getStorageStats() {
  const sqlitePath = getSqlitePath();
  let sizeKb = 0;
  try {
    if (fs.existsSync(sqlitePath)) {
      sizeKb = Math.round(fs.statSync(sqlitePath).size / 1024);
    }
  } catch (_) {}

  return {
    engine: 'SQLite (better-sqlite3 ACID WAL)',
    type: 'sqlite' as const,
    path: sqlitePath,
    sizeKb,
    isZeroCost: true,
  };
}

// Export paths and crypto utilities for convenient server imports
export * from './paths';
export * from './crypto';
export * from './backup';
