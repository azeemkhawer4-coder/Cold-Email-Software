/**
 * OutboundOS Email Validation & CSV Parser Engine
 */

export interface ValidationResult {
  isValidSyntax: boolean;
  isDisposable: boolean;
  domain: string;
  status: 'valid' | 'invalid' | 'risky';
  reason?: string;
}

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'sharklasers.com',
  'throwawaymail.com',
  'yopmail.com',
  'dispostable.com',
]);

export function validateEmailSyntax(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { isValidSyntax: false, isDisposable: false, domain: '', status: 'invalid', reason: 'Missing email' };
  }

  const trimmed = email.trim().toLowerCase();
  // Standard RFC 5322 regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(trimmed)) {
    return { isValidSyntax: false, isDisposable: false, domain: '', status: 'invalid', reason: 'Invalid email syntax format' };
  }

  const parts = trimmed.split('@');
  const domain = parts[1] || '';

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { isValidSyntax: true, isDisposable: true, domain, status: 'risky', reason: 'Disposable email provider' };
  }

  return { isValidSyntax: true, isDisposable: false, domain, status: 'valid' };
}

export interface ParsedCsvLead {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  jobTitle: string;
  company: string;
  website: string;
  domain: string;
  industry: string;
  country: string;
  city: string;
  phone: string;
  linkedinUrl: string;
  customFields: Record<string, string>;
  rawRow: Record<string, string>;
}

export function parseCsvRows(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  if (!csvText) return { headers: [], rows: [] };
  
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        if (inQuotes && line[i + 1] === char) {
          cur += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

export function autoDetectColumnMappings(headers: string[]): Record<string, string> {
  const mappings: Record<string, string> = {};

  const patterns: Record<string, RegExp> = {
    email: /^(email|email[_\s]?address|e-mail)$/i,
    firstName: /^(first[_\s]?name|fname|given[_\s]?name|first)$/i,
    lastName: /^(last[_\s]?name|lname|surname|family[_\s]?name|last)$/i,
    fullName: /^(full[_\s]?name|name|contact[_\s]?name)$/i,
    company: /^(company|company[_\s]?name|organization|account)$/i,
    jobTitle: /^(job[_\s]?title|title|role|position|designation)$/i,
    website: /^(website|url|company[_\s]?website|domain)$/i,
    industry: /^(industry|sector|vertical)$/i,
    country: /^(country|nation|location[_\s]?country)$/i,
    city: /^(city|town|metro)$/i,
    phone: /^(phone|phone[_\s]?number|mobile|telephone|cell)$/i,
    linkedinUrl: /^(linkedin|linkedin[_\s]?url|linkedin[_\s]?profile)$/i,
  };

  headers.forEach(h => {
    for (const [field, regex] of Object.entries(patterns)) {
      if (regex.test(h.trim()) && !mappings[field]) {
        mappings[field] = h;
        break;
      }
    }
  });

  return mappings;
}
