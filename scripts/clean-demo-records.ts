import { getSqliteDatabase, createDatabaseBackup, getDatabase, saveDatabase } from '../src/server/db';

async function main() {
  console.log('[CleanDemoRecords] Initializing database connection...');
  const db = getSqliteDatabase();

  // 1. Take a hot SQLite backup first
  console.log('[CleanDemoRecords] Creating pre-cleanup backup snapshot...');
  const backup = await createDatabaseBackup(db);
  console.log(`[CleanDemoRecords] Hot backup created successfully: ${backup.filename} (${backup.sizeKb} KB) at ${backup.filepath}`);

  // 2. Query demo/seed items
  const demoCampaignIds = ['camp-q4-enterprise', 'camp-fail-test'];
  const testMailboxPrefixes = ['mb-primary-google', 'mb-test-', 'mb-broken-test-'];

  console.log('[CleanDemoRecords] Identifying seed campaigns, mailboxes, and queued jobs...');

  // Identify jobs to delete
  const jobsToDelete = db.prepare(`
    SELECT id, campaign_id, mailbox_id, status FROM sending_jobs
    WHERE campaign_id IN ('camp-q4-enterprise', 'camp-fail-test')
       OR campaign_id LIKE 'camp-test-%'
       OR mailbox_id LIKE 'mb-test-%'
       OR mailbox_id LIKE 'mb-broken-test-%'
       OR mailbox_id = 'mb-primary-google'
       OR status IN ('queued', 'failed', 'retrying')
  `).all() as any[];

  console.log(`[CleanDemoRecords] Found ${jobsToDelete.length} demo/unsafe queue jobs to remove.`);

  // Delete jobs
  const delJobs = db.prepare(`
    DELETE FROM sending_jobs
    WHERE campaign_id IN ('camp-q4-enterprise', 'camp-fail-test')
       OR campaign_id LIKE 'camp-test-%'
       OR campaign_id LIKE 'camp-imm-%'
       OR campaign_id LIKE 'camp-sched-%'
       OR campaign_id LIKE 'camp-kill-%'
       OR mailbox_id LIKE 'mb-test-%'
       OR mailbox_id LIKE 'mb-imm-%'
       OR mailbox_id LIKE 'mb-broken-test-%'
       OR mailbox_id = 'mb-primary-google'
  `);
  const delJobsRes = delJobs.run();
  console.log(`[CleanDemoRecords] Deleted ${delJobsRes.changes} sending jobs.`);

  // Delete sending events
  const delEvents = db.prepare(`
    DELETE FROM sending_events
    WHERE campaign_id IN ('camp-q4-enterprise', 'camp-fail-test')
       OR campaign_id LIKE 'camp-test-%'
       OR campaign_id LIKE 'camp-imm-%'
       OR campaign_id LIKE 'camp-sched-%'
       OR campaign_id LIKE 'camp-kill-%'
       OR mailbox_id LIKE 'mb-test-%'
       OR mailbox_id LIKE 'mb-imm-%'
       OR mailbox_id LIKE 'mb-broken-test-%'
       OR mailbox_id = 'mb-primary-google'
  `).run();
  console.log(`[CleanDemoRecords] Deleted ${delEvents.changes} sending events.`);

  // Delete demo mailboxes (keep real user mailboxes if any)
  const delMb = db.prepare(`
    DELETE FROM email_accounts
    WHERE id = 'mb-primary-google'
       OR id LIKE 'mb-test-%'
       OR id LIKE 'mb-imm-%'
       OR id LIKE 'mb-broken-test-%'
  `).run();
  console.log(`[CleanDemoRecords] Deleted ${delMb.changes} demo/test mailboxes.`);

  // Delete demo campaigns
  const delCamp = db.prepare(`
    DELETE FROM campaigns
    WHERE id IN ('camp-q4-enterprise', 'camp-fail-test')
       OR id LIKE 'camp-test-%'
       OR id LIKE 'camp-imm-%'
       OR id LIKE 'camp-sched-%'
       OR id LIKE 'camp-kill-%'
  `).run();
  console.log(`[CleanDemoRecords] Deleted ${delCamp.changes} demo campaigns.`);

  // Delete campaign steps
  const delSteps = db.prepare(`
    DELETE FROM campaign_steps
    WHERE campaign_id IN ('camp-q4-enterprise', 'camp-fail-test')
       OR campaign_id LIKE 'camp-test-%'
       OR campaign_id LIKE 'camp-imm-%'
       OR campaign_id LIKE 'camp-sched-%'
       OR campaign_id LIKE 'camp-kill-%'
  `).run();
  console.log(`[CleanDemoRecords] Deleted ${delSteps.changes} demo campaign steps.`);

  // Reset leads: keep genuine leads and lists, unassign from deleted demo campaign
  const updateLeads = db.prepare(`
    UPDATE leads
    SET campaign_id = NULL,
        status = 'new',
        updated_at = datetime('now')
    WHERE campaign_id IN ('camp-q4-enterprise', 'camp-fail-test')
       OR campaign_id LIKE 'camp-test-%'
  `).run();
  console.log(`[CleanDemoRecords] Reset ${updateLeads.changes} leads to unassigned/new status.`);

  // Clean in-memory cache
  const state = getDatabase();
  state.campaigns = state.campaigns.filter((c) => !c.id.startsWith('camp-test-') && c.id !== 'camp-q4-enterprise' && c.id !== 'camp-fail-test');
  state.mailboxes = state.mailboxes.filter((m) => m.id !== 'mb-primary-google' && !m.id.startsWith('mb-test-') && !m.id.startsWith('mb-broken-test-'));
  state.sendingJobs = state.sendingJobs.filter((j) => !j.campaignId.startsWith('camp-test-') && j.campaignId !== 'camp-q4-enterprise' && j.campaignId !== 'camp-fail-test');
  state.failureReports = [];
  state.sendingEvents = [];
  saveDatabase(state);

  // Vacuum database
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.exec('VACUUM');

  console.log('[CleanDemoRecords] Database cleanup complete.');
  console.log('Remaining campaigns:', db.prepare('SELECT id, name, status FROM campaigns').all());
  console.log('Remaining mailboxes:', db.prepare('SELECT id, email, name FROM email_accounts').all());
  console.log('Remaining sending jobs:', db.prepare('SELECT count(*) as count FROM sending_jobs').all());
  console.log('Remaining leads count:', db.prepare('SELECT count(*) as count FROM leads').all());
}

main().catch((e) => {
  console.error('[CleanDemoRecords] Error:', e);
  process.exit(1);
});
