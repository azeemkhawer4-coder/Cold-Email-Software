import nodemailer, { Transporter } from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { MailboxAccount, FailureType, InboundMessage } from '../../types';
import { AdapterSendResult } from './gmailAdapter';

// Cache active transporters by mailbox id
const transporterCache = new Map<string, Transporter>();

export function getTransporterForMailbox(mailbox: MailboxAccount): Transporter {
  let transporter = transporterCache.get(mailbox.id);
  if (!transporter) {
    const port = mailbox.smtpPort || (mailbox.smtpSecure ? 465 : 587);
    const host = mailbox.smtpHost || 'smtp.ethereal.email';
    const user = mailbox.smtpUser || mailbox.email;
    const pass = mailbox.smtpPass || process.env[`SMTP_PASS_${mailbox.id}`] || '';

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: mailbox.smtpSecure || port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false, // Permit self-signed corporate or test certs
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    transporterCache.set(mailbox.id, transporter);
  }
  return transporter;
}

export function clearTransporterCache(mailboxId?: string) {
  if (mailboxId) {
    transporterCache.delete(mailboxId);
  } else {
    transporterCache.clear();
  }
}

/**
 * Classifies SMTP errors into actionable failure types
 */
function classifySmtpError(err: any): FailureType {
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toUpperCase();
  const responseCode = err.responseCode;

  if (code === 'EAUTH' || responseCode === 535 || msg.includes('authentication') || msg.includes('bad credentials')) {
    return 'auth';
  }
  if (responseCode === 550 || responseCode === 551 || responseCode === 552 || msg.includes('mailbox unavailable') || msg.includes('user not found')) {
    return 'bounce';
  }
  if (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'ESOCKET' ||
    code === 'EDNS' ||
    msg.includes('enotfound') ||
    msg.includes('getaddrinfo') ||
    msg.includes('connection refused')
  ) {
    return 'smtp_connect';
  }
  if (responseCode === 421 || responseCode === 450 || responseCode === 451 || msg.includes('rate limit') || msg.includes('too many')) {
    return 'rate_limit';
  }
  return 'unknown';
}

/**
 * Verifies real SMTP connection credentials with the server
 */
export async function verifySmtpConnection(mailbox: MailboxAccount): Promise<{ valid: boolean; error?: string }> {
  try {
    const transporter = getTransporterForMailbox(mailbox);
    await transporter.verify();
    return { valid: true };
  } catch (err: any) {
    return {
      valid: false,
      error: `SMTP connection verification failed: ${err.message}`,
    };
  }
}

/**
 * Real SMTP email dispatch using Nodemailer
 * STRICT: Does NOT simulate success. If connection or credentials fail, reports real error.
 */
export async function sendSmtpMessage(
  mailbox: MailboxAccount,
  to: string,
  subject: string,
  bodyHtml: string,
  headers?: Record<string, string>
): Promise<AdapterSendResult & { previewUrl?: string }> {
  if (!mailbox.smtpHost) {
    return {
      success: false,
      provider: 'smtp',
      failureType: 'smtp_connect',
      error: `Mailbox (${mailbox.email}) has no SMTP host configured`,
    };
  }

  try {
    const transporter = getTransporterForMailbox(mailbox);
    const domain = mailbox.email.split('@')[1] || 'outboundos.com';

    const info = await transporter.sendMail({
      from: `"${mailbox.name.replace(/"/g, '')}" <${mailbox.email}>`,
      to,
      subject,
      html: bodyHtml,
      text: bodyHtml.replace(/<[^>]*>/g, ''),
      headers: {
        'X-Mailer': 'OutboundOS High-Deliverability Engine',
        'List-Unsubscribe': `<mailto:unsubscribe@${domain}>`,
        ...headers,
      },
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;

    return {
      success: true,
      provider: 'smtp',
      messageId: info.messageId,
      previewUrl: previewUrl ? String(previewUrl) : undefined,
    };
  } catch (err: any) {
    const failureType = classifySmtpError(err);
    console.error(`[SmtpAdapter] Send error on ${mailbox.email} to ${to}:`, err.message);

    return {
      success: false,
      provider: 'smtp',
      failureType,
      error: `SMTP error: ${err.message}`,
      errorDetails: err.code || String(err.responseCode || ''),
    };
  }
}

/**
 * Real IMAP reply synchronization using ImapFlow
 * Connects to IMAP server and retrieves incoming replies
 */
export async function syncImapReplies(mailbox: MailboxAccount): Promise<InboundMessage[]> {
  const host = mailbox.imapHost || mailbox.smtpHost;
  const user = mailbox.imapUser || mailbox.smtpUser || mailbox.email;
  const pass = mailbox.imapPass || mailbox.smtpPass;

  if (!host || !user || !pass) {
    return [];
  }

  const client = new ImapFlow({
    host,
    port: mailbox.imapPort || 993,
    secure: mailbox.imapSecure !== false,
    auth: { user, pass },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  const messages: InboundMessage[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      // Fetch the last 20 messages from INBOX
      const status = await client.status('INBOX', { messages: true });
      const totalMessages = (status && typeof status === 'object' && typeof status.messages === 'number') ? status.messages : 0;

      if (totalMessages > 0) {
        const fetchRange = totalMessages > 20 ? `${totalMessages - 19}:*` : '1:*';
        const generator = client.fetch(fetchRange, {
          envelope: true,
          source: false,
          bodyStructure: true,
        });

        for await (const msg of generator) {
          const env = msg.envelope;
          if (!env || !env.from || env.from.length === 0) continue;

          const senderObj = env.from[0];
          const senderEmail = (senderObj.address || `${(senderObj as any).mailbox || ''}@${(senderObj as any).host || ''}`).toLowerCase().trim();

          // Skip if sender is the mailbox itself
          if (!senderEmail || senderEmail === mailbox.email.toLowerCase()) continue;

          messages.push({
            id: `imap-msg-${msg.uid || msg.seq}`,
            sender: senderObj.name || senderEmail,
            senderEmail,
            recipientEmail: mailbox.email,
            subject: env.subject || 'Re: Outreach',
            body: `Inbound reply received via IMAP from ${senderObj.name || senderEmail} (${env.subject || 'No Subject'})`,
            timestamp: env.date ? new Date(env.date).toISOString() : new Date().toISOString(),
            isInbound: true,
          });
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return messages;
  } catch (err: any) {
    console.warn(`[ImapAdapter] IMAP sync error for ${mailbox.email}:`, err.message);
    try {
      client.close();
    } catch {}
    return [];
  }
}

/**
 * Provisions a real, live, controlled test mailbox using Nodemailer Ethereal
 * Creates genuine credentials on ethereal.email supporting actual SMTP and IMAP
 */
export async function provisionControlledTestMailbox(workspaceId: string): Promise<MailboxAccount> {
  const testAccount = await nodemailer.createTestAccount();

  const newMailbox: MailboxAccount = {
    id: `mb-test-${Date.now()}`,
    workspaceId,
    email: testAccount.user,
    name: 'Controlled Test Mailbox (Ethereal)',
    provider: 'smtp',
    status: 'connected',
    dailyLimit: 100,
    sentToday: 0,
    warmupStatus: 'active',
    warmupScore: 100,
    healthScore: 100,
    signature: 'Best regards,\nOutboundOS Controlled Test Rig\nVerified Deliverability Sandbox',
    smtpHost: testAccount.smtp.host,
    smtpPort: testAccount.smtp.port,
    smtpUser: testAccount.user,
    smtpPass: testAccount.pass,
    smtpSecure: testAccount.smtp.secure,
    imapHost: testAccount.imap.host,
    imapPort: testAccount.imap.port,
    imapUser: testAccount.user,
    imapPass: testAccount.pass,
    imapSecure: testAccount.imap.secure,
    lastSyncAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    isTestMailbox: true,
    previewUrl: `https://ethereal.email/messages`,
  };

  return newMailbox;
}
