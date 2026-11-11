import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  getSqliteDatabase,
  getStorageStats,
  verifyDatabaseIntegrity,
  createDatabaseBackup,
  listDatabaseBackups,
  hashPassword,
  verifyPassword,
  encryptSecret,
  decryptSecret,
  generateSessionToken,
} from './db';

test('SQLite Engine: journal_mode is WAL and foreign_keys are enabled', () => {
  const db = getSqliteDatabase();
  const jMode = db.pragma('journal_mode') as { journal_mode: string }[];
  assert.equal(jMode[0].journal_mode, 'wal');

  const fk = db.pragma('foreign_keys') as { foreign_keys: number }[];
  assert.equal(fk[0].foreign_keys, 1);
});

test('SQLite Engine: database integrity check passes (healthy)', () => {
  const result = verifyDatabaseIntegrity();
  assert.equal(result.ok, true);
  assert.match(result.message, /passed/i);
});

test('Security & Crypto: AES-256-GCM encrypts and decrypts sensitive OAuth tokens', () => {
  const plainToken = 'ya29.a0ARrdaM-sensitive-google-refresh-token-12345';
  const encrypted = encryptSecret(plainToken);

  assert.notEqual(encrypted, plainToken);
  assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/); // iv:tag:ciphertext

  const decrypted = decryptSecret(encrypted);
  assert.equal(decrypted, plainToken);
});

test('Security & Crypto: Scrypt hashes passwords with random salt and validates correctly', () => {
  const password = 'MyMasterPassword!2026';
  const { hash, salt } = hashPassword(password);

  assert.ok(hash.length > 32);
  assert.ok(salt.length > 16);

  // Valid password matches
  const isValid = verifyPassword(password, hash, salt);
  assert.equal(isValid, true);

  // Wrong password fails
  const isInvalid = verifyPassword('WrongPassword', hash, salt);
  assert.equal(isInvalid, false);
});

test('Database Backup: creates consistent online backup snapshot', async () => {
  const db = getSqliteDatabase();
  const backup = await createDatabaseBackup(db);

  assert.ok(fs.existsSync(backup.filepath));
  assert.ok(backup.sizeKb > 0);
  assert.match(backup.filename, /^outboundos_backup_.*\.sqlite$/);

  // Validate backup file integrity directly
  const backupIntegrity = verifyDatabaseIntegrity(backup.filepath);
  assert.equal(backupIntegrity.ok, true);

  const allBackups = listDatabaseBackups();
  assert.ok(allBackups.length > 0);
  assert.equal(allBackups[0].filename, backup.filename);
});

test('Storage Stats: reports SQLite engine and zero-cost status', () => {
  const stats = getStorageStats();
  assert.equal(stats.type, 'sqlite');
  assert.equal(stats.isZeroCost, true);
  assert.match(stats.engine, /SQLite/i);
  assert.ok(stats.sizeKb >= 0);
});
