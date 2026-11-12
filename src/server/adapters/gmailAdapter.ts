import { MailboxAccount, MailboxOAuthConfig, FailureType, InboundMessage } from '../../types';
import { decryptSecret, encryptSecret } from '../db/crypto';

export interface AdapterSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorDetails?: string;
  failureType?: FailureType;
  provider: string;
}

export interface RefreshResult {
  success: boolean;
  accessToken?: string;
  expiresAt?: number;
  error?: string;
  reauthRequired?: boolean;
}

// Single-flight refresh mutex lock per mailbox to prevent concurrent refreshes from racing
const refreshLocks = new Map<string, Promise<RefreshResult>>();

/**
 * Refreshes an expired Google OAuth access token using the stored refresh_token
 */
export async function refreshGoogleToken(
  oauth: MailboxOAuthConfig
): Promise<RefreshResult> {
  if (!oauth.refreshToken) {
    return { success: false, error: 'No refresh token available', reauthRequired: true };
  }

  const actualRefreshToken = decryptSecret(oauth.refreshToken);
  const clientId = oauth.clientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = oauth.clientSecret || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret || !actualRefreshToken) {
    return {
      success: false,
      error: 'Missing Google Client ID, Client Secret, or Refresh Token in environment/.env',
      reauthRequired: true,
    };
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: actualRefreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      let isInvalidGrant = false;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error === 'invalid_grant' || errJson.error_description?.includes('revoked')) {
          isInvalidGrant = true;
        }
      } catch (_) {
        if (errText.includes('invalid_grant')) isInvalidGrant = true;
      }

      console.error('[GmailAdapter] Failed to refresh token:', res.status, errText);
      return {
        success: false,
        error: isInvalidGrant ? 'Google refresh token revoked or expired' : `Token refresh error HTTP ${res.status}`,
        reauthRequired: isInvalidGrant,
      };
    }

    const data = await res.json();
    const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;

    oauth.accessToken = data.access_token;
    oauth.expiresAt = expiresAt;

    // Preserve existing refresh token if Google does not return a new one
    if (data.refresh_token) {
      oauth.refreshToken = encryptSecret(data.refresh_token);
    }

    return {
      success: true,
      accessToken: data.access_token,
      expiresAt,
    };
  } catch (err: any) {
    console.error('[GmailAdapter] Refresh token exception:', err.message);
    return {
      success: false,
      error: `Network error during token refresh: ${err.message}`,
      reauthRequired: false,
    };
  }
}

/**
 * Ensures mailbox has an active, valid OAuth access token.
 * Performs auto-refresh if expiring within 5 minutes or if forceRefresh is requested.
 * Uses a single-flight mutex lock per mailbox ID to prevent racing requests.
 */
export async function ensureValidGmailToken(
  mailbox: MailboxAccount,
  forceRefresh = false
): Promise<{ token: string | null; error?: string; reauthRequired?: boolean }> {
  const oauth = mailbox.oauth;
  if (!oauth) {
    return {
      token: null,
      error: `Mailbox ${mailbox.email} has no OAuth credentials configured`,
      reauthRequired: true,
    };
  }

  const now = Date.now();
  const isExpiring = !oauth.accessToken || (oauth.expiresAt && oauth.expiresAt <= now + 5 * 60 * 1000);

  if (!forceRefresh && !isExpiring && oauth.accessToken) {
    return { token: oauth.accessToken };
  }

  if (!oauth.refreshToken) {
    return {
      token: null,
      error: `Mailbox ${mailbox.email} is missing a refresh token. Re-authorization required.`,
      reauthRequired: true,
    };
  }

  // Single-flight lock: return in-flight refresh promise if one is already running
  if (refreshLocks.has(mailbox.id)) {
    const existing = await refreshLocks.get(mailbox.id)!;
    return {
      token: existing.accessToken || null,
      error: existing.error,
      reauthRequired: existing.reauthRequired,
    };
  }

  const refreshPromise = (async (): Promise<RefreshResult> => {
    try {
      const result = await refreshGoogleToken(oauth);
      if (result.success && result.accessToken) {
        // Persist refreshed token to SQLite database
        try {
          const { getSqliteDatabase } = await import('../db');
          const db = getSqliteDatabase();
          db.prepare(`
            UPDATE email_accounts
            SET oauth_access_token = ?,
                oauth_expiry = ?,
                status = 'connected',
                data = json_set(data, '$.oauth.accessToken', ?, '$.oauth.expiresAt', ?),
                updated_at = datetime('now')
            WHERE id = ?
          `).run(
            result.accessToken,
            new Date(result.expiresAt!).toISOString(),
            result.accessToken,
            result.expiresAt!,
            mailbox.id
          );
        } catch (dbErr) {
          console.warn('[GmailAdapter] Could not update refreshed token in DB:', dbErr);
        }
      }
      return result;
    } finally {
      refreshLocks.delete(mailbox.id);
    }
  })();

  refreshLocks.set(mailbox.id, refreshPromise);
  const outcome = await refreshPromise;

  return {
    token: outcome.accessToken || null,
    error: outcome.error,
    reauthRequired: outcome.reauthRequired,
  };
}

/**
 * Builds standard RFC 2822 email payload and base64url encodes it for Gmail API
 */
function buildRfc2822Raw(
  fromName: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  htmlContent: string,
  headers?: Record<string, string>
): string {
  const messageId = `<outboundos-${Date.now()}.${Math.random().toString(36).substring(2, 9)}@${fromEmail.split('@')[1] || 'gmail.com'}>`;

  const headerLines: string[] = [
    `From: "${fromName.replace(/"/g, '')}" <${fromEmail}>`,
    `To: <${toEmail}>`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    `X-Mailer: OutboundOS Deliverability Engine`,
  ];

  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      if (v) headerLines.push(`${k}: ${v}`);
    }
  }

  const rawString = `${headerLines.join('\r\n')}\r\n\r\n${Buffer.from(htmlContent, 'utf-8').toString('base64')}`;

  // URL-safe base64 encoding without padding
  return Buffer.from(rawString)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Real Gmail API email dispatch with automatic expired token refresh and single 401 retry
 */
export async function sendGmailMessage(
  mailbox: MailboxAccount,
  to: string,
  subject: string,
  bodyHtml: string,
  headers?: Record<string, string>
): Promise<AdapterSendResult> {
  let tokenResult = await ensureValidGmailToken(mailbox);

  if (!tokenResult.token) {
    if (tokenResult.reauthRequired) {
      mailbox.status = 'reauth_required';
      mailbox.lastError = tokenResult.error || 'Google re-authorization required';
    }
    return {
      success: false,
      provider: 'gmail',
      failureType: 'auth',
      error: tokenResult.error || `Gmail mailbox (${mailbox.email}) is not authenticated with valid OAuth access token`,
      errorDetails: 'Please reconnect this mailbox via Google OAuth in Email Accounts.',
    };
  }

  const raw = buildRfc2822Raw(mailbox.name, mailbox.email, to, subject, bodyHtml, headers);

  try {
    let res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    // If 401 encountered, attempt one token refresh and retry
    if (res.status === 401) {
      console.warn(`[GmailAdapter] 401 on sendGmailMessage for ${mailbox.email}. Forcing token refresh...`);
      tokenResult = await ensureValidGmailToken(mailbox, true);
      if (tokenResult.token) {
        res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenResult.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
        });
      }
    }

    if (!res.ok) {
      const errBody = await res.text();
      let failureType: FailureType = 'unknown';

      if (res.status === 401) {
        failureType = 'auth';
        mailbox.status = 'reauth_required';
        mailbox.lastError = 'Google OAuth token expired or revoked. Re-authentication required.';
      } else if (res.status === 429 || res.status === 403) {
        failureType = 'rate_limit';
        mailbox.status = 'temporary_error';
      } else if (res.status >= 500) {
        failureType = 'network';
        mailbox.status = 'temporary_error';
      }

      return {
        success: false,
        provider: 'gmail',
        failureType,
        error: `Gmail API error HTTP ${res.status}`,
        errorDetails: errBody,
      };
    }

    const data = await res.json();
    mailbox.status = 'connected';
    mailbox.lastError = undefined;

    return {
      success: true,
      provider: 'gmail',
      messageId: data.id || `gmail-${Date.now()}`,
    };
  } catch (err: any) {
    mailbox.status = 'temporary_error';
    mailbox.lastError = err.message;
    return {
      success: false,
      provider: 'gmail',
      failureType: 'network',
      error: `Network error connecting to Gmail API: ${err.message}`,
    };
  }
}

/**
 * Real Gmail API reply synchronization
 * Retrieves latest messages in inbox to identify prospect replies
 * Automatically handles token expiration, auto-refresh, and 401 recovery
 */
export async function syncGmailReplies(mailbox: MailboxAccount): Promise<InboundMessage[]> {
  let tokenResult = await ensureValidGmailToken(mailbox);

  if (!tokenResult.token) {
    if (tokenResult.reauthRequired) {
      mailbox.status = 'reauth_required';
      mailbox.lastError = tokenResult.error || 'Google re-authentication required';
    } else {
      mailbox.status = 'temporary_error';
      mailbox.lastError = tokenResult.error || 'Failed to obtain access token';
    }
    return [];
  }

  try {
    let listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:inbox&maxResults=20',
      {
        headers: { Authorization: `Bearer ${tokenResult.token}` },
      }
    );

    // If 401 encountered, force refresh token once and retry
    if (listRes.status === 401) {
      console.warn(`[GmailAdapter] 401 on syncGmailReplies for ${mailbox.email}. Forcing token refresh...`);
      tokenResult = await ensureValidGmailToken(mailbox, true);
      if (!tokenResult.token) {
        mailbox.status = tokenResult.reauthRequired ? 'reauth_required' : 'temporary_error';
        mailbox.lastError = tokenResult.error || 'Google re-authorization required after 401';
        return [];
      }

      listRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:inbox&maxResults=20',
        {
          headers: { Authorization: `Bearer ${tokenResult.token}` },
        }
      );
    }

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error(`[GmailAdapter] Inbox fetch failed HTTP ${listRes.status}:`, errText);
      mailbox.status = listRes.status === 401 ? 'reauth_required' : 'temporary_error';
      mailbox.lastError = `Gmail API error (${listRes.status}): ${errText}`;
      return [];
    }

    const listData = await listRes.json();
    const messages: InboundMessage[] = [];

    if (!listData.messages || !Array.isArray(listData.messages)) {
      mailbox.status = 'sync_completed';
      mailbox.lastError = undefined;
      return [];
    }

    // Fetch details for recent messages
    for (const item of listData.messages.slice(0, 10)) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=In-Reply-To`,
        {
          headers: { Authorization: `Bearer ${tokenResult.token}` },
        }
      );
      if (!msgRes.ok) continue;

      const detail = await msgRes.json();
      const headers = detail.payload?.headers || [];
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
      const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || new Date().toISOString();

      // Extract sender email
      const match = fromHeader.match(/<([^>]+)>/) || [null, fromHeader];
      const senderEmail = (match[1] || fromHeader).trim().toLowerCase();

      // Skip messages sent from the mailbox itself
      if (senderEmail === mailbox.email.toLowerCase()) continue;

      messages.push({
        id: `gmail-sync-${item.id}`,
        sender: fromHeader.split('<')[0].replace(/"/g, '').trim() || senderEmail,
        senderEmail,
        recipientEmail: mailbox.email,
        subject: subjectHeader,
        body: detail.snippet || '',
        timestamp: new Date(dateHeader).toISOString(),
        isInbound: true,
      });
    }

    mailbox.status = 'sync_completed';
    mailbox.lastError = undefined;
    return messages;
  } catch (err: any) {
    console.error(`[GmailAdapter] Error syncing replies for ${mailbox.email}:`, err.message);
    mailbox.status = 'temporary_error';
    mailbox.lastError = err.message;
    return [];
  }
}
