import { MailboxAccount, MailboxOAuthConfig, FailureType, InboundMessage } from '../../types';
import { AdapterSendResult } from './gmailAdapter';
import { decryptSecret } from '../db/crypto';

/**
 * Refreshes an expired Microsoft Graph OAuth access token using the stored refresh_token
 */
export async function refreshMicrosoftToken(
  oauth: MailboxOAuthConfig
): Promise<{ accessToken: string; expiresAt: number } | null> {
  if (!oauth.refreshToken) return null;

  const actualRefreshToken = decryptSecret(oauth.refreshToken);
  const clientId = oauth.clientId || process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = oauth.clientSecret || process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = oauth.tenantId || process.env.MICROSOFT_TENANT_ID || 'common';

  if (!clientId || !clientSecret || !actualRefreshToken) {
    return null;
  }

  try {
    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: actualRefreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/.default offline_access',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[MicrosoftAdapter] Failed to refresh token:', res.status, errText);
      return null;
    }

    const data = await res.json();
    const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    oauth.accessToken = data.access_token;
    oauth.expiresAt = expiresAt;
    return { accessToken: data.access_token, expiresAt };
  } catch (err: any) {
    console.error('[MicrosoftAdapter] Refresh token exception:', err.message);
    return null;
  }
}

/**
 * Real Microsoft Graph email dispatch via /me/sendMail
 * STRICT: Does NOT simulate success. If unauthenticated or provider returns error, returns real failure.
 */
export async function sendMicrosoftGraphMessage(
  mailbox: MailboxAccount,
  to: string,
  subject: string,
  bodyHtml: string,
  headers?: Record<string, string>
): Promise<AdapterSendResult> {
  let token = mailbox.oauth?.accessToken;

  // Check if token needs refresh
  if (mailbox.oauth?.expiresAt && mailbox.oauth.expiresAt <= Date.now() + 60000 && mailbox.oauth.refreshToken) {
    const refreshed = await refreshMicrosoftToken(mailbox.oauth);
    if (refreshed) {
      token = refreshed.accessToken;
    }
  }

  if (!token) {
    return {
      success: false,
      provider: 'outlook',
      failureType: 'auth',
      error: `Microsoft Outlook mailbox (${mailbox.email}) is not authenticated with valid OAuth access token`,
      errorDetails: 'Please connect this mailbox via Microsoft 365 OAuth in Email Accounts or provide a valid access token.',
    };
  }

  try {
    const internetMessageHeaders: { name: string; value: string }[] = [];

    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (v) internetMessageHeaders.push({ name: k, value: v });
      }
    }

    const payload = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: bodyHtml,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
        internetMessageHeaders,
      },
      saveToSentItems: 'true',
    };

    const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      let failureType: FailureType = 'unknown';

      if (res.status === 401) {
        failureType = 'auth';
      } else if (res.status === 429) {
        failureType = 'rate_limit';
      } else if (res.status >= 500) {
        failureType = 'network';
      }

      return {
        success: false,
        provider: 'outlook',
        failureType,
        error: `Microsoft Graph API error HTTP ${res.status}`,
        errorDetails: errBody,
      };
    }

    // Graph /sendMail returns 202 Accepted on success with empty body
    return {
      success: true,
      provider: 'outlook',
      messageId: `ms-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
  } catch (err: any) {
    return {
      success: false,
      provider: 'outlook',
      failureType: 'network',
      error: `Network error connecting to Microsoft Graph API: ${err.message}`,
    };
  }
}

/**
 * Real Microsoft Graph reply synchronization
 * Retrieves latest messages from the inbox to detect prospect replies
 */
export async function syncMicrosoftReplies(mailbox: MailboxAccount): Promise<InboundMessage[]> {
  const token = mailbox.oauth?.accessToken;
  if (!token) return [];

  try {
    const res = await fetch(
      'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=20&$select=id,from,subject,bodyPreview,receivedDateTime,internetMessageId',
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    const messages: InboundMessage[] = [];

    if (!data.value || !Array.isArray(data.value)) {
      return [];
    }

    for (const item of data.value) {
      const senderEmail = item.from?.emailAddress?.address?.trim().toLowerCase() || '';
      if (!senderEmail || senderEmail === mailbox.email.toLowerCase()) continue;

      messages.push({
        id: `ms-sync-${item.id}`,
        sender: item.from?.emailAddress?.name || senderEmail,
        senderEmail,
        recipientEmail: mailbox.email,
        subject: item.subject || '',
        body: item.bodyPreview || '',
        timestamp: item.receivedDateTime ? new Date(item.receivedDateTime).toISOString() : new Date().toISOString(),
        isInbound: true,
      });
    }

    return messages;
  } catch (err: any) {
    console.error(`[MicrosoftAdapter] Error syncing replies for ${mailbox.email}:`, err.message);
    return [];
  }
}
