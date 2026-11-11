import { getSqliteDatabase, createDatabaseBackup, listDatabaseBackups, restoreDatabaseBackup, verifyDatabaseIntegrity, reopenDatabase } from '../src/server/db';
import { getBackupsDir, getSqlitePath } from '../src/server/db/paths';

const action = process.argv[2] || 'status';

async function main() {
  console.log('===============================================================================');
  console.log('                   OutboundOS SQLite Database CLI Tool');
  console.log('===============================================================================');

  if (action === 'backup') {
    console.log('[Backup] Initiating ACID snapshot of active SQLite database...');
    try {
      const db = getSqliteDatabase();
      const backup = await createDatabaseBackup(db);
      console.log('[OK] Backup created successfully!');
      console.log(`     File: ${backup.filename}`);
      console.log(`     Path: ${backup.filepath}`);
      console.log(`     Size: ${backup.sizeKb} KB`);
    } catch (err: any) {
      console.error('[ERROR] Backup failed:', err.message);
      process.exit(1);
    }
  } else if (action === 'restore') {
    const filename = process.argv[3];
    if (!filename) {
      console.log('[ERROR] Please specify the backup filename to restore.');
      console.log('Usage: npx tsx scripts/db-cli.ts restore <filename>');
      const backups = listDatabaseBackups();
      console.log('\nAvailable Backups:');
      backups.forEach((b, i) => console.log(`  [${i + 1}] ${b.filename} (${b.sizeKb} KB, ${b.createdAt})`));
      process.exit(1);
    }

    console.log(`[Restore] Restoring database from: ${filename}...`);
    try {
      const db = getSqliteDatabase();
      const result = restoreDatabaseBackup(db, filename, reopenDatabase);
      if (result.success) {
        console.log('[OK]', result.message);
      } else {
        console.error('[ERROR]', result.message);
        process.exit(1);
      }
    } catch (err: any) {
      console.error('[ERROR] Restore exception:', err.message);
      process.exit(1);
    }
  } else if (action === 'integrity') {
    console.log('[Integrity] Verifying SQLite database integrity...');
    const result = verifyDatabaseIntegrity();
    if (result.ok) {
      console.log('[OK]', result.message);
    } else {
      console.error('[ERROR]', result.message);
      process.exit(1);
    }
  } else if (action === 'list') {
    console.log(`[Backups Directory] ${getBackupsDir()}`);
    const backups = listDatabaseBackups();
    console.log(`Found ${backups.length} backup(s):`);
    backups.forEach((b, i) => {
      console.log(`  ${i + 1}. ${b.filename} | ${b.sizeKb} KB | ${new Date(b.createdAt).toLocaleString()}`);
    });
  } else {
    console.log(`Active Database: ${getSqlitePath()}`);
    const integrity = verifyDatabaseIntegrity();
    console.log(`Integrity: ${integrity.ok ? 'HEALTHY' : 'CORRUPTED'}`);
    const backups = listDatabaseBackups();
    console.log(`Total Backups: ${backups.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
