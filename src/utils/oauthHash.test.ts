import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOAuthHashRoute, getGoogleOAuthFeedback } from './oauthHash';

test('parseOAuthHashRoute parses #mailboxes?connected=google&email=...', () => {
  const parsed = parseOAuthHashRoute('#mailboxes?connected=google&email=marlar%40gmail.com');
  assert.equal(parsed.tab, 'mailboxes');
  assert.equal(parsed.connected, 'google');
  assert.equal(parsed.email, 'marlar@gmail.com');
  assert.equal(parsed.error, undefined);
});

test('parseOAuthHashRoute parses #mailboxes?error=token_exchange_failed', () => {
  const parsed = parseOAuthHashRoute('#mailboxes?error=token_exchange_failed');
  assert.equal(parsed.tab, 'mailboxes');
  assert.equal(parsed.error, 'token_exchange_failed');
});

test('parseOAuthHashRoute ignores unknown tabs while handling valid tabs without query', () => {
  assert.deepEqual(parseOAuthHashRoute('#settings'), { tab: 'settings' });
  assert.deepEqual(parseOAuthHashRoute('#unknown-tab'), { tab: null });
  assert.deepEqual(parseOAuthHashRoute(''), { tab: null });
});

test('getGoogleOAuthFeedback maps connected and error codes cleanly', () => {
  const ok = getGoogleOAuthFeedback({ connected: 'google', email: 'marlar@gmail.com' });
  assert.equal(ok?.type, 'success');
  assert.ok(ok?.message.includes('marlar@gmail.com'));

  const denied = getGoogleOAuthFeedback({ error: 'access_denied' });
  assert.equal(denied?.type, 'error');
  assert.ok(denied?.message.includes('cancelled'));

  const missing = getGoogleOAuthFeedback({ error: 'oauth_config_missing' });
  assert.equal(missing?.type, 'error');
  assert.ok(missing?.message.includes('GOOGLE_CLIENT_ID'));

  assert.equal(getGoogleOAuthFeedback({}), null);
});
