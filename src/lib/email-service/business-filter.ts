/**
 * Business-Only Filter & Privacy-First Templating
 * Filters out non-business domains and handles template rendering without persistent storage
 */

// Comprehensive blocklist of non-business/free email providers
const FREE_EMAIL_BLOCKLIST = new Set([
  // Gmail
  'gmail.com', 'googlemail.com',
  // Yahoo
  'yahoo.com', 'ymail.com', 'yahoo.co.uk', 'yahoo.com.au', 'yahoo.co.jp', 'yahoo.co.in', 'yahoo.com.ph',
  // Microsoft/Outlook
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'passport.com', 'windowslive.com',
  // AOL
  'aol.com', 'aim.com', 'cs.com',
  // Apple
  'icloud.com', 'me.com', 'mac.com', 'apple.com',
  // Proton
  'protonmail.com', 'proton.me', 'pm.me',
  // Tutanota
  'tutanota.com', 'tutamail.com', 'tuta.io',
  // Zoho
  'zoho.com', 'zohomail.com',
  // Mail
  'mail.com', 'email.com', 'inbox.com', 'gmx.com', 'gmx.us', 'gmx.de',
  // Yandex
  'yandex.com', 'yandex.ru', 'yandex.ua', 'yandex.eu',
  // Generic free providers
  'inbox.ru', 'bk.ru', 'list.ru', 'mail.ru', 'rambler.ru',
  'qq.com', '126.com', '163.com', 'sina.com', 'sohu.com',
  'rediffmail.com', 'indiatimes.com',
  'webmail.co.za', 'mweb.co.za',
  // Disposable domains
  'mailinator.com', 'guerrillamail.com', 'guerrillamailblock.com', 'sharklasers.com',
  'throwaway.email', 'temp-mail.org', '10minutemail.com', 'fakeinbox.com',
  'trashmail.com', 'dispostable.com', 'maildrop.cc',
  // More free providers
  'fastmail.com', 'fastmail.fm',
  'hey.com', 'dismail.de', 'email.de',
  'runbox.com', 'hushmail.com',
  // Custom catch-all test domains
  'example.com', 'test.com', 'localhost',
]);

export interface BusinessLead {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  customData?: Record<string, string>;
}

export interface FilterResult {
  business: BusinessLead[];
  filtered: { email: string; reason: string }[];
  stats: {
    total: number;
    businessCount: number;
    filteredCount: number;
  };
}

export interface TemplateRenderOptions {
  html?: string;
  text?: string;
  placeholders: Record<string, string>;
}

/**
 * Filter leads to business-only domains
 * Does NOT log or persist any email addresses
 */
export function filterBusinessOnly(leads: BusinessLead[]): FilterResult {
  const business: BusinessLead[] = [];
  const filtered: { email: string; reason: string }[] = [];

  for (const lead of leads) {
    const domain = extractDomain(lead.email);

    if (!domain) {
      filtered.push({ email: 'REDACTED', reason: 'Invalid email format' });
      continue;
    }

    if (FREE_EMAIL_BLOCKLIST.has(domain.toLowerCase())) {
      filtered.push({ email: 'REDACTED', reason: 'Free email provider' });
      continue;
    }

    // Check for common free provider patterns in domain
    if (isSuspiciousDomain(domain)) {
      filtered.push({ email: 'REDACTED', reason: 'Suspicious domain pattern' });
      continue;
    }

    business.push(lead);
  }

  return {
    business,
    filtered,
    stats: {
      total: leads.length,
      businessCount: business.length,
      filteredCount: filtered.length,
    },
  };
}

/**
 * Extract domain from email
 */
function extractDomain(email: string): string | null {
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const domain = parts[1].toLowerCase().trim();
  return domain.length > 0 ? domain : null;
}

/**
 * Check for suspicious patterns in domain
 */
function isSuspiciousDomain(domain: string): boolean {
  // Check for IP addresses instead of domains
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return true;

  // Check for localhost or internal domains
  if (domain.includes('localhost') || domain.includes('.local')) return true;

  // Check for numeric-only domains (often disposable)
  if (/^\d+$/.test(domain)) return true;

  // Check for extremely long domains (often generated)
  if (domain.length > 100) return true;

  return false;
}

/**
 * Render HTML template with placeholder substitution
 * Works directly on strings without persistence
 */
export function renderHtmlTemplate(
  html: string,
  placeholders: Record<string, string>
): string {
  let result = html;

  // Replace common placeholders with case-insensitive matching
  for (const [key, value] of Object.entries(placeholders)) {
    // Support {{name}}, {{ name }}, {{name }}, etc.
    const patterns = [
      new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'gi'),
      new RegExp(`\\{\\{\\s*${escapeRegex(key.toLowerCase())}\\s*\\}\\}`, 'gi'),
    ];

    for (const pattern of patterns) {
      result = result.replace(pattern, escapeHtml(value));
    }
  }

  // Clean up any unmatched placeholders
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
}

/**
 * Render text template with placeholder substitution
 */
export function renderTextTemplate(
  text: string,
  placeholders: Record<string, string>
): string {
  let result = text;

  for (const [key, value] of Object.entries(placeholders)) {
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'gi');
    result = result.replace(pattern, value);
  }

  // Clean up any unmatched placeholders
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Build lead data for template rendering
 */
export function buildLeadPlaceholders(lead: BusinessLead): Record<string, string> {
  return {
    email: lead.email,
    name: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Friend',
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    company: lead.company || '',
    ...(lead.customData || {}),
  };
}

/**
 * Validate a single email for business use
 */
export function isBusinessEmail(email: string): boolean {
  const domain = extractDomain(email);
  if (!domain) return false;
  if (FREE_EMAIL_BLOCKLIST.has(domain.toLowerCase())) return false;
  if (isSuspiciousDomain(domain)) return false;
  return true;
}

/**
 * Get count of business emails in a list (without filtering)
 */
export function countBusinessEmails(emails: string[]): number {
  return emails.filter(isBusinessEmail).length;
}