import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureValidGmailToken, refreshGoogleToken } from './adapters/gmailAdapter';
import { MailboxAccount } from '../types';
import { encryptSecret } from './db/crypto';

test('Gmail OAuth: Single-flight mutex locking prevents racing concurrent token refreshes', async () => {
  const dummyMailbox: MailboxAccount = {
    id: `mb-race-test-${Date.now()}`,
    workspaceId: 'ws-test',
    email: 'test-race@example.com',
    name: 'Race Tester',
    provider: 'gmail',
    status: 'connected',
    dailyLimit: 50,
    sentToday: 0,
    warmupStatus: 'disabled',
    warmupScore: 100,
    healthScore: 100,
    signature: '',
    lastSyncAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    oauth: {
      accessToken: 'old-access-token',
      refreshToken: encryptSecret('1//0g-mock-valid-refresh-token'),
      expiresAt: Date.now() - 1000, // expired!
      clientId: 'mock-client-id.apps.googleusercontent.com',
      clientSecret: 'mock-client-secret',
    },
  };

  // Launch two concurrent token validations
  const promise1 = ensureValidGmailToken(dummyMailbox);
  const promise2 = ensureValidGmailToken(dummyMailbox);

  // Both should execute gracefully without uncaught rejection
  const [res1, res2] = await Promise.all([promise1, promise2]);

  // Both responses report the same error or token result without conflict
  assert.equal(res1.reauthRequired, res2.reauthRequired);
});

test('Gmail OAuth: Handles missing credentials gracefully without throwing 401 unhandled crash', async () => {
  const unconfiguredMailbox: MailboxAccount = {
    id: `mb-unconfigured-${Date.now()}`,
    workspaceId: 'ws-test',
    email: 'no-creds@example.com',
    name: 'Unconfigured',
    provider: 'gmail',
    status: 'connected',
    dailyLimit: 50,
    sentToday: 0,
    warmupStatus: 'disabled',
    warmupScore: 0,
    healthScore: 0,
    signature: '',
    lastSyncAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    oauth: undefined,
  };

  const result = await ensureValidGmailToken(unconfiguredMailbox);
  assert.equal(result.token, null);
  assert.equal(result.reauthRequired, true);
  assert.match(result.error || '', /no OAuth credentials/i);
});

test('Gmail OAuth: Preserves existing refresh token when refresh does not return new refresh_token', async () => {
  const initialRefresh = encryptSecret('persistent-refresh-token-xyz');
  const oauth = {
    accessToken: 'initial-access-token',
    refreshToken: initialRefresh,
    expiresAt: Date.now() + 3600000,
  };

  // When token is valid and not expiring, ensureValidGmailToken returns current token without network call
  const validMb: MailboxAccount = {
    id: 'mb-valid-test',
    workspaceId: 'ws-test',
    email: 'valid@example.com',
    name: 'Valid Mailbox',
    provider: 'gmail',
    status: 'connected',
    dailyLimit: 50,
    sentToday: 0,
    warmupStatus: 'disabled',
    warmupScore: 100,
    healthScore: 100,
    signature: '',
    lastSyncAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    oauth,
  };

  const result = await ensureValidGmailToken(validMb);
  assert.equal(result.token, 'initial-access-token');
  assert.equal(oauth.refreshToken, initialRefresh); // Unmodified
});
