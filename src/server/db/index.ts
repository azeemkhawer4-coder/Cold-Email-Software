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
import { reconcileCompanies, reconcileLeadLists } from '../../utils/analyticsStats';

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
    timezone: 'America/Chicago',
    physicalAddress: '548 Market St, Suite 39201, San Francisco, CA 94104',
    unsubscribeFooter: 'You received this email because we identified synergy with your role. If you prefer not to receive future updates, click here to unsubscribe.',
    complianceMode: 'strict',
    globalSuppressionCount: 0,
  };

  const now = new Date().toISOString();

  // Workspace defaults only — no fake/demo leads, lists, companies, campaigns, mailboxes, tasks, or deals
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

  console.log('[SQLite] Initialized clean workspace settings (no demo records seeded).');
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
      timezone: 'America/Chicago',
      physicalAddress: '548 Market St, San Francisco, CA',
      unsubscribeFooter: 'Click here to unsubscribe.',
      complianceMode: 'strict',
      globalSuppressionCount: 0,
    };

    // 2. Leads
    const leadRows = db.prepare('SELECT data FROM leads ORDER BY created_at DESC').all() as { data: string }[];
    const leads: Lead[] = leadRows.map((r) => JSON.parse(r.data));

    // 3. Deals
    const dealRows = db.prepare('SELECT data FROM deals ORDER BY created_at DESC').all() as { data: string }[];
    const deals: Deal[] = dealRows.map((r) => JSON.parse(r.data));

    // 4. Companies (dynamically reconciled against leads & non-lost deals)
    const compRows = db.prepare('SELECT data FROM companies ORDER BY name ASC').all() as { data: string }[];
    const rawCompanies: Company[] = compRows.map((r) => JSON.parse(r.data));
    const companies = reconcileCompanies(rawCompanies, leads, deals);

    // 5. Lists (dynamically reconciled against leads)
    const listRows = db.prepare('SELECT * FROM lists ORDER BY created_at DESC').all() as any[];
    const rawLists: LeadList[] = listRows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      description: r.description || '',
      leadCount: r.lead_count || 0,
      tags: r.tags ? JSON.parse(r.tags) : [],
      type: r.type || 'static',
      createdAt: r.created_at,
    }));
    const lists = reconcileLeadLists(rawLists, leads);

    // 6. Campaigns
    const campRows = db.prepare('SELECT data FROM campaigns ORDER BY created_at DESC').all() as { data: string }[];
    const campaigns: Campaign[] = campRows.map((r) => JSON.parse(r.data));

    // 7. Mailboxes (reconcile OAuth columns and normalize legacy sync_completed status)
    const mbRows = db.prepare(
      'SELECT data, oauth_refresh_token_encrypted, oauth_access_token, oauth_expiry FROM email_accounts ORDER BY created_at DESC'
    ).all() as {
      data: string;
      oauth_refresh_token_encrypted?: string | null;
      oauth_access_token?: string | null;
      oauth_expiry?: string | null;
    }[];
    const mailboxes: MailboxAccount[] = mbRows.map((r) => {
      const mb: MailboxAccount = JSON.parse(r.data);
      if (mb.status === 'sync_completed') {
        mb.status = 'connected';
        if (!mb.syncStatus) mb.syncStatus = 'completed';
      }
      if (mb.dailyLimit == null && mb.dailyQuota != null) mb.dailyLimit = mb.dailyQuota;
      if (mb.dailyQuota == null && mb.dailyLimit != null) mb.dailyQuota = mb.dailyLimit;
      if (mb.sentToday == null) mb.sentToday = 0;

      if (r.oauth_refresh_token_encrypted || r.oauth_access_token) {
        mb.oauth = {
          ...(mb.oauth || {}),
          refreshToken: mb.oauth?.refreshToken || r.oauth_refresh_token_encrypted || undefined,
          accessToken: mb.oauth?.accessToken || r.oauth_access_token || undefined,
          expiresAt:
            mb.oauth?.expiresAt ||
            (r.oauth_expiry ? new Date(r.oauth_expiry).getTime() : undefined),
        };
      }
      return mb;
    });

    // 8. Conversations
    const convRows = db.prepare('SELECT data FROM conversations ORDER BY last_message_at DESC').all() as { data: string }[];
    const conversations: Conversation[] = convRows.map((r) => JSON.parse(r.data));

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

  // Reconcile computed fields prior to atomic persistence
  if (Array.isArray(data.lists) && Array.isArray(data.leads)) {
    data.lists = reconcileLeadLists(data.lists, data.leads);
  }
  if (Array.isArray(data.companies) && Array.isArray(data.leads) && Array.isArray(data.deals)) {
    data.companies = reconcileCompanies(data.companies, data.leads, data.deals);
  }

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
      data.workspace.timezone || 'America/Chicago',
      data.workspace.physicalAddress,
      data.workspace.unsubscribeFooter,
      data.workspace.complianceMode,
      data.suppressionList.length,
      JSON.stringify(data.workspace),
      now
    );

    // 1b. Lists (persist creation, updates & deletions!)
    if (Array.isArray(data.lists)) {
      const listIds = data.lists.map((l) => l.id);
      if (listIds.length > 0) {
        db.prepare(`DELETE FROM lists WHERE id NOT IN (${listIds.map(() => '?').join(',')})`).run(...listIds);
      } else {
        db.prepare('DELETE FROM lists').run();
      }
      const upsertList = db.prepare(`
        INSERT OR REPLACE INTO lists (id, workspace_id, name, description, lead_count, tags, type, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of data.lists) {
        upsertList.run(
          l.id,
          data.workspace.id,
          l.name,
          l.description || '',
          l.leadCount ?? 0,
          JSON.stringify(l.tags || []),
          l.type || 'static',
          JSON.stringify(l),
          l.createdAt || now
        );
      }
    }

    // 2. Leads (sync deletions as well as upserts)
    if (Array.isArray(data.leads)) {
      const leadIds = data.leads.map((l) => l.id);
      if (leadIds.length > 0) {
        db.prepare(`DELETE FROM leads WHERE id NOT IN (${leadIds.map(() => '?').join(',')})`).run(...leadIds);
      } else {
        db.prepare('DELETE FROM leads').run();
      }
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
          l.firstName || '',
          l.lastName || '',
          l.fullName || '',
          l.company || '',
          l.jobTitle || '',
          l.domain || '',
          l.phone || null,
          l.linkedinUrl || null,
          l.status || 'new',
          l.verificationStatus || 'unknown',
          l.unsubscribeStatus ? 1 : 0,
          l.bounceStatus ? 1 : 0,
          JSON.stringify(l),
          l.dateAdded || now,
          now
        );
      }
    }

    // 3. Companies (sync deletions as well as upserts)
    if (Array.isArray(data.companies)) {
      const compIds = data.companies.map((c) => c.id);
      if (compIds.length > 0) {
        db.prepare(`DELETE FROM companies WHERE id NOT IN (${compIds.map(() => '?').join(',')})`).run(...compIds);
      } else {
        db.prepare('DELETE FROM companies').run();
      }
      const upsertCompany = db.prepare(`
        INSERT OR REPLACE INTO companies (id, workspace_id, name, domain, industry, employee_count, location, website, leads_count, deals_count, total_value, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of data.companies) {
        upsertCompany.run(
          c.id,
          data.workspace.id,
          c.name,
          c.domain || '',
          c.industry || '',
          c.employeeCount || '50-200',
          c.location || 'United States',
          c.website || '',
          c.leadsCount ?? 0,
          c.dealsCount ?? 0,
          c.totalValue ?? 0,
          JSON.stringify(c),
          c.createdAt || now,
          now
        );
      }
    }

    // 4. Sending Jobs (sync deletions first to maintain FK integrity with campaigns)
    if (Array.isArray(data.sendingJobs)) {
      const jobIds = data.sendingJobs.map((j) => j.id);
      if (jobIds.length > 0) {
        db.prepare(`DELETE FROM sending_jobs WHERE id NOT IN (${jobIds.map(() => '?').join(',')})`).run(...jobIds);
      } else {
        db.prepare('DELETE FROM sending_jobs').run();
      }
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
          j.scheduledFor || j.scheduledAt || now,
          j.status || 'queued',
          j.attempts || 0,
          j.maxAttempts || 5,
          j.lastAttemptAt || null,
          j.lastError || null,
          j.idempotencyKey,
          j.sentMessageId || j.messageId || null,
          JSON.stringify(j),
          j.createdAt || now,
          now
        );
      }
    }

    // 5. Campaigns
    if (Array.isArray(data.campaigns)) {
      const campIds = data.campaigns.map((c) => c.id);
      if (campIds.length > 0) {
        db.prepare(`DELETE FROM campaigns WHERE id NOT IN (${campIds.map(() => '?').join(',')})`).run(...campIds);
      } else {
        db.prepare('DELETE FROM campaigns').run();
      }
      const upsertCamp = db.prepare(`
        INSERT OR REPLACE INTO campaigns (id, workspace_id, list_id, name, status, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of data.campaigns) {
        upsertCamp.run(c.id, data.workspace.id, c.listId || c.leadListId || null, c.name, c.status, JSON.stringify(c), c.createdAt || now, now);
      }
    }

    // 6. Mailboxes (persist full OAuth + SMTP/IMAP credentials & quotas cleanly)
    if (Array.isArray(data.mailboxes)) {
      const mbIds = data.mailboxes.map((m) => m.id);
      if (mbIds.length > 0) {
        db.prepare(`DELETE FROM email_accounts WHERE id NOT IN (${mbIds.map(() => '?').join(',')})`).run(...mbIds);
      } else {
        db.prepare('DELETE FROM email_accounts').run();
      }
      const upsertMb = db.prepare(`
        INSERT OR REPLACE INTO email_accounts (
          id, workspace_id, email, name, provider, status,
          daily_quota, sent_today, daily_warmup_limit, warmup_sent_today, warmup_enabled,
          smtp_host, smtp_port, smtp_user, smtp_pass_encrypted,
          imap_host, imap_port, imap_user, imap_pass_encrypted,
          oauth_refresh_token_encrypted, oauth_access_token, oauth_expiry,
          data, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const m of data.mailboxes) {
        const quota = m.dailyQuota ?? m.dailyLimit ?? 50;
        const sent = m.sentToday ?? 0;
        const normalizedStatus = m.status === 'sync_completed' ? 'connected' : (m.status || 'connected');
        const normalizedMailbox: MailboxAccount = {
          ...m,
          status: normalizedStatus,
          dailyQuota: quota,
          dailyLimit: m.dailyLimit ?? quota,
          sentToday: sent,
        };
        const oauthExpiryIso = m.oauth?.expiresAt
          ? new Date(m.oauth.expiresAt).toISOString()
          : null;
        upsertMb.run(
          m.id,
          data.workspace.id,
          m.email,
          m.name || m.email,
          m.provider || 'smtp',
          normalizedStatus,
          quota,
          sent,
          m.warmupDailyLimit ?? 20,
          m.warmupSentToday ?? 0,
          m.warmupEnabled || m.warmupStatus === 'active' ? 1 : 0,
          m.smtpHost || null,
          m.smtpPort ?? null,
          m.smtpUser || null,
          m.smtpPass || null,
          m.imapHost || null,
          m.imapPort ?? null,
          m.imapUser || null,
          m.imapPass || null,
          m.oauth?.refreshToken || null,
          m.oauth?.accessToken || null,
          oauthExpiryIso,
          JSON.stringify(normalizedMailbox),
          m.createdAt || now,
          now
        );
      }
    }

    // 7. Tasks (sync deletions as well as upserts)
    if (Array.isArray(data.tasks)) {
      const taskIds = data.tasks.map((t) => t.id);
      if (taskIds.length > 0) {
        db.prepare(`DELETE FROM tasks WHERE id NOT IN (${taskIds.map(() => '?').join(',')})`).run(...taskIds);
      } else {
        db.prepare('DELETE FROM tasks').run();
      }
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

    // 8. Deals (sync deletions as well as upserts)
    if (Array.isArray(data.deals)) {
      const dealIds = data.deals.map((d) => d.id);
      if (dealIds.length > 0) {
        db.prepare(`DELETE FROM deals WHERE id NOT IN (${dealIds.map(() => '?').join(',')})`).run(...dealIds);
      } else {
        db.prepare('DELETE FROM deals').run();
      }
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
      const convIds = data.conversations.map((c) => c.id);
      if (convIds.length > 0) {
        db.prepare(`DELETE FROM conversations WHERE id NOT IN (${convIds.map(() => '?').join(',')})`).run(...convIds);
      } else {
        db.prepare('DELETE FROM conversations').run();
      }
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

    // 10. Automations (persist creation, updates & deletions!)
    if (Array.isArray(data.automations)) {
      const autoIds = data.automations.map((a) => a.id);
      if (autoIds.length > 0) {
        db.prepare(`DELETE FROM automations WHERE id NOT IN (${autoIds.map(() => '?').join(',')})`).run(...autoIds);
      } else {
        db.prepare('DELETE FROM automations').run();
      }
      const upsertAuto = db.prepare(`
        INSERT OR REPLACE INTO automations (id, workspace_id, name, trigger_event, enabled, execution_count, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of data.automations) {
        upsertAuto.run(
          a.id,
          data.workspace.id,
          a.name,
          a.triggerEvent,
          a.enabled ? 1 : 0,
          a.executionCount ?? 0,
          JSON.stringify(a),
          now
        );
      }
    }

    // 11. Suppressions
    if (Array.isArray(data.suppressionList)) {
      const upsertSupp = db.prepare(`
        INSERT OR REPLACE INTO suppression_records (id, workspace_id, email, reason, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const s of data.suppressionList) {
        upsertSupp.run(
          `supp-${s.email.toLowerCase().trim()}`,
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
    dbCache = null;
    console.error('[SQLite] Transaction failed during saveDatabase:', err);
    throw err;
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
