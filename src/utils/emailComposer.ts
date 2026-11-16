import { isPublicTrackingUrl } from './openTracking';

const LEGACY_BOILERPLATE_ADDRESSES = new Set([
  '548 market st, suite 39201, san francisco, ca 94104',
  '548 market st, san francisco, ca',
]);

const LEGACY_BOILERPLATE_FOOTERS = new Set([
  'you received this email because we identified synergy with your role. if you prefer not to receive future updates, click here to unsubscribe.',
  'click here to unsubscribe.',
]);

const LEGACY_BOILERPLATE_SIGNATURES = new Set([
  '--\nbest regards,\napex outbound',
  'best regards,\napex outbound',
]);

export function isLegacyBoilerplateAddress(value?: string | null): boolean {
  if (!value) return false;
  return LEGACY_BOILERPLATE_ADDRESSES.has(value.trim().toLowerCase());
}

export function isLegacyBoilerplateFooter(value?: string | null): boolean {
  if (!value) return false;
  return LEGACY_BOILERPLATE_FOOTERS.has(value.trim().toLowerCase());
}

export function isLegacyBoilerplateSignature(value?: string | null): boolean {
  if (!value) return false;
  const normalized = value.replace(/\r\n/g, '\n').trim().toLowerCase();
  return LEGACY_BOILERPLATE_SIGNATURES.has(normalized);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function containsHtmlMarkup(text: string): boolean {
  return /<\/?(p|div|br|span|a|ul|ol|li|strong|em|b|i|table|tr|td|html|body)\b[^>]*>/i.test(text);
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSignature(signature?: string | null): string {
  if (!signature) return '';
  if (isLegacyBoilerplateSignature(signature)) return '';
  const normalized = signature.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  // Strip any leading "--" separator line so we never generate "-- --"
  return normalized.replace(/^--+\s*\n?/, '').trim();
}

export function textToCleanHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '<div></div>';

  // If caller intentionally supplied HTML markup, wrap cleanly without collapsing tags
  if (containsHtmlMarkup(normalized)) {
    return `<div dir="ltr" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #222222;">${normalized}</div>`;
  }

  const paragraphs = normalized.split(/\n{2,}/);
  const renderedParagraphs = paragraphs.map((para) => {
    const safeLines = para
      .split('\n')
      .map((line) => escapeHtml(line))
      .join('<br>');
    return `<div style="margin: 0 0 12px 0;">${safeLines}</div>`;
  });

  return `<div dir="ltr" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #222222;">${renderedParagraphs.join('')}</div>`;
}

export interface ComposeEmailOptions {
  body: string;
  signature?: string | null;
  physicalAddress?: string | null;
  unsubscribeFooter?: string | null;
  includeComplianceFooter?: boolean;
  plainTextOnly?: boolean;
  trackingPixelUrl?: string | null;
}

export interface ComposedEmailResult {
  textBody: string;
  htmlBody?: string;
  pixelInjected: boolean;
}

/**
 * Composes clean, human-like 1:1 cold email plain-text & HTML payloads.
 * - Preserves paragraphs & line breaks so Gmail never collapses text into a single spammy wall.
 * - Eliminates legacy spam-fingerprint footers ("548 Market St", "identified synergy", "Apex Outbound", "-- --").
 * - Appends signature cleanly without duplicate delimiters.
 * - Only appends compliance footer if explicitly enabled and non-boilerplate.
 * - Only injects open-tracking pixel when HTML is allowed and URL is publicly reachable.
 */
export function composeOutboundEmail(options: ComposeEmailOptions): ComposedEmailResult {
  const rawBody = (options.body || '').replace(/\r\n/g, '\n').trim();
  const isHtmlInput = containsHtmlMarkup(rawBody);
  const basePlain = isHtmlInput ? stripHtmlTags(rawBody) : rawBody;

  const sections: string[] = [];
  if (basePlain) sections.push(basePlain);

  const cleanSig = normalizeSignature(options.signature);
  if (cleanSig && !basePlain.toLowerCase().endsWith(cleanSig.toLowerCase())) {
    sections.push(cleanSig);
  }

  if (options.includeComplianceFooter) {
    const addr =
      options.physicalAddress && !isLegacyBoilerplateAddress(options.physicalAddress)
        ? options.physicalAddress.trim()
        : '';
    const unsub =
      options.unsubscribeFooter && !isLegacyBoilerplateFooter(options.unsubscribeFooter)
        ? options.unsubscribeFooter.trim()
        : '';
    const footerParts = [addr, unsub].filter(Boolean);
    if (footerParts.length > 0) {
      sections.push(footerParts.join('\n'));
    }
  }

  const textBody = sections.join('\n\n').trim();

  if (options.plainTextOnly) {
    return {
      textBody,
      htmlBody: undefined,
      pixelInjected: false,
    };
  }

  let htmlBody = isHtmlInput
    ? textToCleanHtml(
        [
          rawBody,
          cleanSig && !basePlain.toLowerCase().endsWith(cleanSig.toLowerCase())
            ? `<div style="margin-top: 12px;">${escapeHtml(cleanSig).replace(/\n/g, '<br>')}</div>`
            : '',
          options.includeComplianceFooter
            ? [
                options.physicalAddress && !isLegacyBoilerplateAddress(options.physicalAddress)
                  ? escapeHtml(options.physicalAddress.trim())
                  : '',
                options.unsubscribeFooter && !isLegacyBoilerplateFooter(options.unsubscribeFooter)
                  ? escapeHtml(options.unsubscribeFooter.trim())
                  : '',
              ]
                .filter(Boolean)
                .join('<br>')
            : '',
        ]
          .filter(Boolean)
          .join('')
      )
    : textToCleanHtml(textBody);

  let pixelInjected = false;
  if (options.trackingPixelUrl && isPublicTrackingUrl(options.trackingPixelUrl)) {
    const safeUrl = escapeHtml(options.trackingPixelUrl);
    const pixelTag = `<img src="${safeUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0;" />`;
    if (htmlBody.endsWith('</div>')) {
      htmlBody = `${htmlBody.slice(0, -6)}${pixelTag}</div>`;
    } else {
      htmlBody = `${htmlBody}${pixelTag}`;
    }
    pixelInjected = true;
  }

  return {
    textBody,
    htmlBody,
    pixelInjected,
  };
}

function encodeSubjectHeader(subject: string): string {
  const clean = subject.replace(/[\r\n]+/g, ' ').trim();
  // Pure ASCII subjects look like natural human messages in Gmail
  if (/^[\x20-\x7E]*$/.test(clean)) {
    return clean;
  }
  return `=?UTF-8?B?${Buffer.from(clean, 'utf-8').toString('base64')}?=`;
}

function formatFromHeader(fromName: string, fromEmail: string): string {
  const cleanEmail = fromEmail.replace(/[\r\n<>]+/g, '').trim();
  const cleanName = (fromName || '').replace(/[\r\n"]+/g, '').trim();
  if (!cleanName || cleanName.toLowerCase() === cleanEmail.toLowerCase()) {
    return `<${cleanEmail}>`;
  }
  if (/^[\x20-\x7E]*$/.test(cleanName)) {
    const needsQuotes = /[(),:;<>@[\]\\."]/.test(cleanName);
    return needsQuotes ? `"${cleanName}" <${cleanEmail}>` : `${cleanName} <${cleanEmail}>`;
  }
  return `=?UTF-8?B?${Buffer.from(cleanName, 'utf-8').toString('base64')}?= <${cleanEmail}>`;
}

function wrapBase64(b64: string): string {
  return b64.replace(/(.{76})/g, '$1\r\n').trim();
}

export interface BuildMimeParams {
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  plainTextOnly?: boolean;
  headers?: Record<string, string>;
}

/**
 * Builds a clean, standards-compliant RFC 2822 payload for Gmail API without spam-trigger headers.
 * Sends multipart/alternative (text/plain + text/html) by default, or single-part text/plain when plainTextOnly=true.
 */
export function buildMimeEmailString(params: BuildMimeParams): string {
  const domain = params.fromEmail.split('@')[1] || 'gmail.com';
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2, 10)}@${domain}>`;
  const cleanTo = params.toEmail.replace(/[\r\n<>]+/g, '').trim();

  const baseHeaders: string[] = [
    `From: ${formatFromHeader(params.fromName, params.fromEmail)}`,
    `To: <${cleanTo}>`,
    `Subject: ${encodeSubjectHeader(params.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
  ];

  if (params.headers) {
    for (const [k, v] of Object.entries(params.headers)) {
      const cleanKey = k.replace(/[\r\n:]+/g, '').trim();
      const cleanVal = String(v || '').replace(/[\r\n]+/g, ' ').trim();
      if (cleanKey && cleanVal) {
        baseHeaders.push(`${cleanKey}: ${cleanVal}`);
      }
    }
  }

  const textPayload = wrapBase64(Buffer.from(params.textBody || '', 'utf-8').toString('base64'));

  if (params.plainTextOnly || !params.htmlBody) {
    return [
      ...baseHeaders,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      '',
      textPayload,
    ].join('\r\n');
  }

  const boundary = `=_alt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  const htmlPayload = wrapBase64(Buffer.from(params.htmlBody, 'utf-8').toString('base64'));

  return [
    ...baseHeaders,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    '',
    textPayload,
    '',
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    '',
    htmlPayload,
    '',
    `--${boundary}--`,
  ].join('\r\n');
}

export function encodeBase64Url(rawString: string): string {
  return Buffer.from(rawString, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface SpamAuditResult {
  spamScore: number; // 0-100 deliverability safety score (100 = cleanest)
  deliverabilityScore: number;
  status: 'safe' | 'moderate_risk' | 'high_risk';
  detectedKeywords: string[];
  detectedIssues: string[];
  advice: string;
}

/**
 * Evaluates cold-email subject & body against real-world Gmail spam triggers.
 */
export function analyzeEmailSpamRisk(params: {
  subject?: string;
  body?: string;
  physicalAddress?: string;
  unsubscribeFooter?: string;
}): SpamAuditResult {
  const subject = params.subject || '';
  const body = params.body || '';
  const combined = `${subject}\n${body}\n${params.physicalAddress || ''}\n${params.unsubscribeFooter || ''}`;
  const lower = combined.toLowerCase();

  const spamTriggers = [
    'free',
    'guarantee',
    '100% free',
    'earn money',
    'risk-free',
    'no catch',
    'miracle',
    'urgent',
    'act now',
    'winner',
    'credit card',
    'congratulations',
    'click here to unsubscribe',
    'identified synergy',
  ];

  const detectedKeywords: string[] = [];
  for (const trigger of spamTriggers) {
    if (lower.includes(trigger)) {
      detectedKeywords.push(trigger);
    }
  }

  const detectedIssues: string[] = [];
  let penalty = detectedKeywords.length * 12;

  if (/https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(combined)) {
    detectedIssues.push('Contains localhost/127.0.0.1 URL (major Gmail spam trigger)');
    penalty += 30;
  }

  if (lower.includes('548 market st') || lower.includes('apex outbound')) {
    detectedIssues.push('Contains shared template boilerplate address/brand ("548 Market St" or "Apex Outbound")');
    penalty += 25;
  }

  if (/--\s*\n?\s*--/.test(combined)) {
    detectedIssues.push('Contains duplicate "-- --" signature separator');
    penalty += 10;
  }

  if (/\{\{[^}]+\}\}/.test(body.replace(/\{\{[^|}]+\|\s*fallback:[^}]+\}\}/gi, ''))) {
    // Only warn if no fallback; standard template preview note handled separately
  }

  const linkCount = (combined.match(/https?:\/\/\S+/gi) || []).length;
  if (linkCount > 2) {
    detectedIssues.push(`High link count (${linkCount} URLs; keep first-touch cold emails to 0-1 links)`);
    penalty += 15;
  }

  if (/!{2,}/.test(combined)) {
    detectedIssues.push('Multiple consecutive exclamation marks');
    penalty += 10;
  }

  const allCapsMatches = subject.match(/\b[A-Z]{4,}\b/g) || [];
  if (allCapsMatches.length > 0) {
    detectedIssues.push(`ALL CAPS words in subject (${allCapsMatches.join(', ')})`);
    penalty += 10;
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));
  const status = score >= 85 ? 'safe' : score >= 60 ? 'moderate_risk' : 'high_risk';

  const summaryParts: string[] = [];
  if (detectedIssues.length > 0) {
    summaryParts.push(detectedIssues.join('. ') + '.');
  }
  if (detectedKeywords.length > 0) {
    summaryParts.push(`Remove flagged phrases: "${detectedKeywords.join('", "')}".`);
  }

  const advice =
    summaryParts.length === 0
      ? 'Copy passes Gmail deliverability checks. Structure, line breaks, and tone look natural.'
      : summaryParts.join(' ');

  return {
    spamScore: score,
    deliverabilityScore: score,
    status,
    detectedKeywords,
    detectedIssues,
    advice,
  };
}
