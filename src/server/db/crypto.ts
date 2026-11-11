import fs from 'fs';
import crypto from 'crypto';
import { getSecretKeyPath } from './paths';

let cachedKey: Buffer | null = null;

/**
 * Returns or generates the 256-bit AES master encryption key.
 * Stored locally in .secret_key outside version control.
 */
export function getMasterEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const keyPath = getSecretKeyPath();
  if (fs.existsSync(keyPath)) {
    try {
      const keyHex = fs.readFileSync(keyPath, 'utf8').trim();
      if (keyHex.length === 64) {
        cachedKey = Buffer.from(keyHex, 'hex');
        return cachedKey;
      }
    } catch (_) {}
  }

  // Generate new random 32-byte key (256-bit)
  const newKey = crypto.randomBytes(32);
  try {
    fs.writeFileSync(keyPath, newKey.toString('hex'), { mode: 0o600 });
  } catch (err) {
    console.warn('[Crypto] Could not write .secret_key to disk, using in-memory key:', err);
  }

  cachedKey = newKey;
  return cachedKey;
}

/**
 * Encrypt sensitive string (e.g. OAuth refresh token, SMTP password) using AES-256-GCM
 * Output format: <iv_hex>:<auth_tag_hex>:<cipher_hex>
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const key = getMasterEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypt AES-256-GCM string
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload || !encryptedPayload.includes(':')) {
    return encryptedPayload; // Return as-is if unencrypted or empty
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    return encryptedPayload;
  }

  try {
    const key = getMasterEncryptionKey();
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    console.error('[Crypto] Failed to decrypt payload:', err.message);
    return '';
  }
}

/**
 * Hash password with scrypt and unique random salt
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

/**
 * Verify plaintext password against stored scrypt hash & salt
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!password || !hash || !salt) return false;
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    if (keyBuffer.length !== hashBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, hashBuffer);
  } catch (_) {
    return false;
  }
}

/**
 * Generate cryptographically secure random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
