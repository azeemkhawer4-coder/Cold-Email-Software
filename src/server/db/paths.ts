import path from 'path';
import fs from 'fs';

/**
 * OutboundOS Local SQLite Directory & File Path Resolver
 * 
 * Supports:
 * - Windows: %LOCALAPPDATA%\OutboundOS\data\outboundos.sqlite
 * - Override: OUTBOUNDOS_DATA_DIR environment variable
 * - Fallback: <workspace_root>/data/outboundos.sqlite (for development & tests)
 */
export function resolveDataDir(): string {
  if (process.env.OUTBOUNDOS_DATA_DIR) {
    return path.resolve(process.env.OUTBOUNDOS_DATA_DIR);
  }

  // Windows Local AppData
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.resolve(process.env.LOCALAPPDATA, 'OutboundOS', 'data');
  }

  // Fallback for Linux, macOS, and container environments
  return path.resolve(process.cwd(), 'data');
}

export function ensureDirectory(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

export function getSqlitePath(): string {
  const dir = ensureDirectory(resolveDataDir());
  return path.join(dir, 'outboundos.sqlite');
}

export function getSecretKeyPath(): string {
  const dir = ensureDirectory(resolveDataDir());
  return path.join(dir, '.secret_key');
}

export function getBackupsDir(): string {
  const dir = resolveDataDir();
  const backupsDir = path.join(dir, 'backups');
  return ensureDirectory(backupsDir);
}

export function getLegacyDbPath(): string {
  const dir = ensureDirectory(resolveDataDir());
  return path.join(dir, 'outboundos.db.json');
}
