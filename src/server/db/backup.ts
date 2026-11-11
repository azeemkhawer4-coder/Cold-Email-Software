import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getBackupsDir, getSqlitePath } from './paths';

export interface BackupInfo {
  filename: string;
  filepath: string;
  sizeKb: number;
  createdAt: string;
}

/**
 * Creates a timestamped, ACID-consistent backup of the active SQLite database
 * using better-sqlite3's online backup API.
 */
export async function createDatabaseBackup(db: Database.Database): Promise<BackupInfo> {
  const backupsDir = getBackupsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `outboundos_backup_${timestamp}.sqlite`;
  const backupPath = path.join(backupsDir, filename);

  // Use better-sqlite3 online backup to ensure non-blocking transactional consistency
  await db.backup(backupPath);

  const stats = fs.statSync(backupPath);
  return {
    filename,
    filepath: backupPath,
    sizeKb: Math.round(stats.size / 1024),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Lists all existing database backups ordered newest first
 */
export function listDatabaseBackups(): BackupInfo[] {
  const backupsDir = getBackupsDir();
  if (!fs.existsSync(backupsDir)) return [];

  const files = fs.readdirSync(backupsDir);
  const backups: BackupInfo[] = [];

  for (const file of files) {
    if (file.endsWith('.sqlite') || file.endsWith('.db')) {
      const fullPath = path.join(backupsDir, file);
      try {
        const stats = fs.statSync(fullPath);
        backups.push({
          filename: file,
          filepath: fullPath,
          sizeKb: Math.round(stats.size / 1024),
          createdAt: stats.mtime.toISOString(),
        });
      } catch (_) {}
    }
  }

  // Newest first
  return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Verifies the integrity of a SQLite database file using PRAGMA integrity_check
 */
export function verifyDatabaseIntegrity(filepath?: string): { ok: boolean; message: string } {
  const targetPath = filepath || getSqlitePath();
  if (!fs.existsSync(targetPath)) {
    return { ok: false, message: `Database file not found at ${targetPath}` };
  }

  try {
    const testDb = new Database(targetPath, { readonly: true, fileMustExist: true });
    try {
      const result = testDb.pragma('integrity_check') as { integrity_check: string }[];
      testDb.close();
      const status = result && result[0] ? result[0].integrity_check : 'unknown';
      if (status === 'ok') {
        return { ok: true, message: 'SQLite database integrity check passed (healthy).' };
      }
      return { ok: false, message: `Integrity check failed: ${status}` };
    } catch (err: any) {
      try { testDb.close(); } catch (_) {}
      return { ok: false, message: `Integrity check failed: ${err.message}` };
    }
  } catch (err: any) {
    return { ok: false, message: `Failed to open database for integrity verification: ${err.message}` };
  }
}

/**
 * Restores the SQLite database from a selected backup file after performing safety checks
 */
export function restoreDatabaseBackup(
  currentDb: Database.Database,
  backupFilename: string,
  reopenDb: () => Database.Database
): { success: boolean; message: string } {
  const backupsDir = getBackupsDir();
  const backupPath = path.join(backupsDir, path.basename(backupFilename));

  if (!fs.existsSync(backupPath)) {
    return { success: false, message: `Backup file ${backupFilename} does not exist.` };
  }

  // 1. Verify backup file integrity before replacing live database
  const integrity = verifyDatabaseIntegrity(backupPath);
  if (!integrity.ok) {
    return { success: false, message: `Cannot restore: backup file failed integrity check (${integrity.message})` };
  }

  // 2. Perform a pre-restore emergency backup of current state
  try {
    const livePath = getSqlitePath();
    if (fs.existsSync(livePath)) {
      const emergencyPath = path.join(backupsDir, `pre_restore_${Date.now()}.sqlite`);
      fs.copyFileSync(livePath, emergencyPath);
    }
  } catch (err) {
    console.warn('[Backup] Pre-restore copy failed:', err);
  }

  // 3. Safely close current connection
  try {
    currentDb.close();
  } catch (e) {
    console.warn('[Backup] Error closing db:', e);
  }

  // 4. Overwrite main database with the verified backup
  const targetPath = getSqlitePath();
  try {
    // Also remove WAL / SHM files if present
    try { fs.unlinkSync(`${targetPath}-wal`); } catch (_) {}
    try { fs.unlinkSync(`${targetPath}-shm`); } catch (_) {}

    fs.copyFileSync(backupPath, targetPath);

    // Reopen database
    reopenDb();
    return { success: true, message: `Database successfully restored from ${backupFilename}.` };
  } catch (err: any) {
    reopenDb();
    return { success: false, message: `Restore failed: ${err.message}` };
  }
}
