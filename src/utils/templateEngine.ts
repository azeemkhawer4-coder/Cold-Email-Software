/**
 * OutboundOS Template Engine
 * Handles personalized cold email variable interpolation with fallback support:
 * e.g. {{first_name | fallback: "there"}} or {{company}}
 */

export interface LeadContext {
  [key: string]: any;
}

export function extractTemplateVariables(template: string): string[] {
  if (!template) return [];
  const regex = /\{\{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*fallback:\s*(?:"([^"]*)"|'([^']*)'))?\s*\}\}/g;
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    vars.add(match[1].toLowerCase());
  }
  return Array.from(vars);
}

export function interpolateTemplate(template: string, lead: LeadContext): string {
  if (!template) return '';

  // Normalizes lead keys to lowercase for resilient matching
  const normalizedLead: Record<string, any> = {};
  for (const key of Object.keys(lead)) {
    normalizedLead[key.toLowerCase()] = lead[key];
    // Map common aliases
    if (key === 'firstName') normalizedLead['first_name'] = lead[key];
    if (key === 'lastName') normalizedLead['last_name'] = lead[key];
    if (key === 'jobTitle') normalizedLead['job_title'] = lead[key];
    if (key === 'companyName') normalizedLead['company'] = lead[key];
  }

  // Support nested customFields dictionary
  if (lead.customFields && typeof lead.customFields === 'object') {
    for (const [cfKey, cfVal] of Object.entries(lead.customFields)) {
      normalizedLead[cfKey.toLowerCase()] = cfVal;
    }
  }

  // Handle {{var | fallback: "fallbackValue"}} or {{var}}
  const regex = /\{\{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*fallback:\s*(?:"([^"]*)"|'([^']*)'))?\s*\}\}/g;

  return template.replace(regex, (fullMatch, varName, fallbackDouble, fallbackSingle) => {
    const key = varName.toLowerCase();
    const fallback = fallbackDouble !== undefined ? fallbackDouble : (fallbackSingle !== undefined ? fallbackSingle : '');
    
    const value = normalizedLead[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
    
    return fallback;
  });
}
