import { MailboxAccount, MailboxOAuthConfig, FailureType, InboundMessage } from '../../types';
import { decryptSecret } from '../db/crypto';

export interface AdapterSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorDetails?: string;
  failureType?: FailureType;
  provider: string;
}

/**
 * Refreshes an expired Google OAuth access token using the stored refresh_token
 */
export async function refreshGoogleToken(
  oauth: MailboxOAuthConfig
): Promise<{ accessToken: string; expiresAt: number } | null> {
  if (!oauth.refreshToken) return null;

  const actualRefreshToken = decryptSecret(oauth.refreshToken);
  const clientId = oauth.clientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = oauth.clientSecret || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret || !actualRefreshToken) {
    return null;
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
      console.error('[GmailAdapter] Failed to refresh token:', res.status, errText);
      return null;
    }

    const data = await res.json();
    const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    oauth.accessToken = data.access_token;
    oauth.expiresAt = expiresAt;
    return { accessToken: data.access_token, expiresAt };
  } catch (err: any) {
    console.error('[GmailAdapter] Refresh token exception:', err.message);
    return null;
  }
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
  const boundary = `====_OutboundOS_${Date.now()}_====`;
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
 * Real Gmail API email dispatch
 * STRICT: Does NOT simulate success. If unauthenticated or provider returns error, returns real failure.
 */
export async function sendGmailMessage(
  mailbox: MailboxAccount,
  to: string,
  subject: string,
  bodyHtml: string,
  headers?: Record<string, string>
): Promise<AdapterSendResult> {
  let token = mailbox.oauth?.accessToken;

  // Check if token needs refresh
  if (mailbox.oauth?.expiresAt && mailbox.oauth.expiresAt <= Date.now() + 60000 && mailbox.oauth.refreshToken) {
    const refreshed = await refreshGoogleToken(mailbox.oauth);
    if (refreshed) {
      token = refreshed.accessToken;
    }
  }

  if (!token) {
    return {
      success: false,
      provider: 'gmail',
      failureType: 'auth',
      error: `Gmail mailbox (${mailbox.email}) is not authenticated with valid OAuth access token`,
      errorDetails: 'Please connect this mailbox via Google OAuth in Email Accounts or provide a valid access token.',
    };
  }

  try {
    const raw = buildRfc2822Raw(mailbox.name, mailbox.email, to, subject, bodyHtml, headers);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      let failureType: FailureType = 'unknown';

      if (res.status === 401) {
        failureType = 'auth';
      } else if (res.status === 429 || res.status === 403) {
        failureType = 'rate_limit';
      } else if (res.status >= 500) {
        failureType = 'network';
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
    return {
      success: true,
      provider: 'gmail',
      messageId: data.id || `gmail-${Date.now()}`,
    };
  } catch (err: any) {
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
 */
export async function syncGmailReplies(mailbox: MailboxAccount): Promise<InboundMessage[]> {
  const token = mailbox.oauth?.accessToken;
  if (!token) return [];

  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:inbox&maxResults=20',
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!listRes.ok) return [];
    const listData = await listRes.json();
    const messages: InboundMessage[] = [];

    if (!listData.messages || !Array.isArray(listData.messages)) {
      return [];
    }

    // Fetch details for recent messages
    for (const item of listData.messages.slice(0, 10)) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=In-Reply-To`,
        {
          headers: { Authorization: `Bearer ${token}` },
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

    return messages;
  } catch (err: any) {
    console.error(`[GmailAdapter] Error syncing replies for ${mailbox.email}:`, err.message);
    return [];
  }
}
