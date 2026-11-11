import type Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: '001_initial_complete_schema',
    up: (db: Database.Database) => {
      // 1. Users & Local Sessions
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'admin',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      `);

      // 2. Workspaces & Settings
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          company_name TEXT,
          owner_email TEXT,
          timezone TEXT DEFAULT 'America/Los_Angeles',
          physical_address TEXT,
          unsubscribe_footer TEXT,
          compliance_mode TEXT DEFAULT 'strict',
          global_suppression_count INTEGER DEFAULT 0,
          data TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // 3. Lists, Segments, Custom Fields
      db.exec(`
        CREATE TABLE IF NOT EXISTS lists (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          name TEXT NOT NULL,
          description TEXT,
          lead_count INTEGER DEFAULT 0,
          tags TEXT,
          type TEXT DEFAULT 'static',
          data TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS segments (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          name TEXT NOT NULL,
          criteria TEXT NOT NULL,
          lead_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS custom_fields (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          name TEXT NOT NULL,
          field_key TEXT NOT NULL,
          field_type TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      // 4. Companies & Target Accounts
      db.exec(`
        CREATE TABLE IF NOT EXISTS companies (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          name TEXT NOT NULL,
          domain TEXT,
          industry TEXT,
          employee_count TEXT,
          location TEXT,
          phone TEXT,
          website TEXT,
          notes TEXT,
          leads_count INTEGER DEFAULT 0,
          deals_count INTEGER DEFAULT 0,
          total_value REAL DEFAULT 0,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
      `);

      // 5. Leads & Contacts
      db.exec(`
        CREATE TABLE IF NOT EXISTS leads (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          list_id TEXT,
          campaign_id TEXT,
          email TEXT NOT NULL,
          first_name TEXT,
          last_name TEXT,
          full_name TEXT,
          company TEXT,
          job_title TEXT,
          domain TEXT,
          phone TEXT,
          linkedin_url TEXT,
          status TEXT DEFAULT 'new',
          verification_status TEXT DEFAULT 'unverified',
          unsubscribe_status INTEGER DEFAULT 0,
          bounce_status INTEGER DEFAULT 0,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
        CREATE INDEX IF NOT EXISTS idx_leads_workspace ON leads(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_leads_list ON leads(list_id);
        CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      `);

      // 6. Campaigns, Sequence Steps & Variants
      db.exec(`
        CREATE TABLE IF NOT EXISTS campaigns (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          list_id TEXT,
          name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS campaign_steps (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          step_number INTEGER NOT NULL,
          step_type TEXT NOT NULL,
          delay_hours INTEGER DEFAULT 0,
          subject TEXT,
          body TEXT,
          variant_subject TEXT,
          variant_body TEXT,
          data TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS campaign_variants (
          id TEXT PRIMARY KEY,
          step_id TEXT,
          campaign_id TEXT NOT NULL,
          name TEXT NOT NULL,
          subject TEXT,
          body TEXT,
          weight REAL DEFAULT 50.0,
          sent_count INTEGER DEFAULT 0,
          reply_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
        CREATE INDEX IF NOT EXISTS idx_steps_campaign ON campaign_steps(campaign_id);
      `);

      // 7. Email Accounts & Mailboxes
      db.exec(`
        CREATE TABLE IF NOT EXISTS email_accounts (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          provider TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'connected',
          daily_quota INTEGER DEFAULT 50,
          sent_today INTEGER DEFAULT 0,
          daily_warmup_limit INTEGER DEFAULT 20,
          warmup_sent_today INTEGER DEFAULT 0,
          warmup_enabled INTEGER DEFAULT 1,
          smtp_host TEXT,
          smtp_port INTEGER,
          smtp_user TEXT,
          smtp_pass_encrypted TEXT,
          imap_host TEXT,
          imap_port INTEGER,
          imap_user TEXT,
          imap_pass_encrypted TEXT,
          oauth_refresh_token_encrypted TEXT,
          oauth_access_token TEXT,
          oauth_expiry TEXT,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_email_accounts_email ON email_accounts(email);
        CREATE INDEX IF NOT EXISTS idx_email_accounts_provider ON email_accounts(provider);
      `);

      // 8. Unified Inbox, Conversations & Messages
      db.exec(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          lead_id TEXT,
          lead_email TEXT NOT NULL,
          lead_name TEXT,
          lead_company TEXT,
          campaign_id TEXT,
          mailbox_id TEXT,
          mailbox_email TEXT,
          subject TEXT NOT NULL,
          status TEXT DEFAULT 'unread',
          category TEXT DEFAULT 'general',
          last_message_at TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS email_messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT,
          lead_id TEXT,
          mailbox_id TEXT,
          campaign_id TEXT,
          step_id TEXT,
          direction TEXT NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          snippet TEXT,
          is_inbound INTEGER DEFAULT 0,
          sent_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_conversations_lead_email ON conversations(lead_email);
        CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON email_messages(conversation_id);
      `);

      // 9. Sending Engine Queue & Events
      db.exec(`
        CREATE TABLE IF NOT EXISTS sending_jobs (
          id TEXT PRIMARY KEY,
          campaign_id TEXT NOT NULL,
          step_id TEXT NOT NULL,
          lead_id TEXT NOT NULL,
          mailbox_id TEXT,
          scheduled_for TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 5,
          last_attempt_at TEXT,
          last_error TEXT,
          idempotency_key TEXT UNIQUE NOT NULL,
          sent_message_id TEXT,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sending_events (
          id TEXT PRIMARY KEY,
          campaign_id TEXT,
          step_id TEXT,
          lead_id TEXT,
          mailbox_id TEXT,
          event_type TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          metadata TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_jobs_status_sched ON sending_jobs(status, scheduled_for);
        CREATE INDEX IF NOT EXISTS idx_jobs_camp_lead ON sending_jobs(campaign_id, lead_id);
        CREATE INDEX IF NOT EXISTS idx_jobs_idempotency ON sending_jobs(idempotency_key);
        CREATE INDEX IF NOT EXISTS idx_events_camp_lead ON sending_events(campaign_id, lead_id);
      `);

      // 10. CRM: Deals, Pipelines, Tasks
      db.exec(`
        CREATE TABLE IF NOT EXISTS deals (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          lead_id TEXT,
          title TEXT NOT NULL,
          value REAL DEFAULT 0,
          stage TEXT NOT NULL DEFAULT 'new',
          owner TEXT,
          meeting_date TEXT,
          notes TEXT,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          lead_id TEXT,
          deal_id TEXT,
          title TEXT NOT NULL,
          description TEXT,
          due_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          priority TEXT NOT NULL DEFAULT 'medium',
          assigned_to TEXT,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS crm_pipelines (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          name TEXT NOT NULL,
          stages TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      `);

      // 11. Automations, Suppressions, Integrations, Audit Logs
      db.exec(`
        CREATE TABLE IF NOT EXISTS automations (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          name TEXT NOT NULL,
          trigger_event TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          execution_count INTEGER DEFAULT 0,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS suppression_records (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          email TEXT UNIQUE NOT NULL,
          reason TEXT NOT NULL,
          source TEXT DEFAULT 'manual',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS unsubscribe_events (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          lead_email TEXT NOT NULL,
          campaign_id TEXT,
          reason TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS integrations (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          provider TEXT NOT NULL,
          config_encrypted TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'info',
          is_read INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          user_id TEXT,
          action TEXT NOT NULL,
          entity_type TEXT,
          entity_id TEXT,
          details_json TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_suppression_email ON suppression_records(email);
        CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at);
      `);
    },
  },
];

/**
 * Execute pending SQL migrations in a single database transaction
 */
export function runMigrations(db: Database.Database): void {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: number }[];
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const m of migrations) {
    if (!appliedVersions.has(m.version)) {
      console.log(`[Migrations] Applying migration ${m.version}: ${m.name}...`);
      const applyTx = db.transaction(() => {
        m.up(db);
        db.prepare('INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(m.version, m.name, new Date().toISOString());
      });
      applyTx();
      console.log(`[Migrations] Migration ${m.version} applied successfully.`);
    }
  }
}
