/**
 * Deliverability Optimization Suite
 * Tools to maximize inbox placement and avoid spam folders
 */

export interface DnsRecord {
  type: 'SPF' | 'DKIM' | 'DMARC' | 'MX' | 'PTR';
  domain: string;
  value: string;
  found: boolean;
  valid: boolean;
  issues: string[];
}

export interface SpamScoreResult {
  score: number;
  maxScore: number;
  isSpam: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    weight: number;
    detail: string;
  }>;
  suggestions: string[];
}

export interface BounceClassification {
  email: string;
  type: 'hard' | 'soft' | 'blocked' | 'unknown';
  reason: string;
  shouldRemove: boolean;
}

export interface SenderReputation {
  bounceRate: number;
  complaintRate: number;
  spamRate: number;
  engagementRate: number;
  score: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  warnings: string[];
}

const SPAM_TRIGGER_WORDS = [
  'free', 'act now', 'limited time', 'click here', 'congratulations', 'you won',
  'buy now', 'discount', 'offer expires', 'guaranteed', 'cash bonus', 'urgent',
  'exclusive deal', 'amazing', 'call now', 'don\'t delete', 'double your',
  'earn extra', 'extra cash', 'fast cash', 'financial freedom', 'for only',
  'free access', 'free consultation', 'free gift', 'free info', 'free membership',
  'free money', 'free preview', 'free quote', 'free trial', 'full refund',
  'get out of debt', 'get paid', 'great offer', 'income from home', 'incredible deal',
  'instant access', 'limited supply', 'loans', 'lowest price', 'make money',
  'million dollars', 'miracle', 'no cost', 'no fees', 'no hidden costs',
  'no obligation', 'not spam', 'one time', 'opt in', 'order now', 'please read',
  'promise you', 'real thing', 'refund', 'request now', 'reserves the right',
  'satisfaction guaranteed', 'save up to', 'serious cash', 'subject to...',
  'terms and conditions', 'the best rates', 'trial', 'unlimited', 'void where prohibited',
  'weight loss', 'while supplies last', 'work at home', 'you are a winner',
];

const SUSPICIOUS_TLDS = ['.xyz', '.top', '.loan', '.work', '.date', '.win', '.bid', '.download', '.review', '.party', '.racing', '.stream'];

/**
 * Check DNS records for a domain (SPF, DKIM, DMARC, MX, PTR)
 */
export async function checkDomainHealth(domain: string): Promise<DnsRecord[]> {
  const records: DnsRecord[] = [];

  // Check MX records
  try {
    const mxRes = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const mxData = await mxRes.json();
    const mxFound = mxData.Answer && mxData.Answer.length > 0;
    records.push({
      type: 'MX',
      domain,
      value: mxFound ? mxData.Answer.map((a: any) => a.data).join(', ') : '',
      found: mxFound,
      valid: mxFound,
      issues: mxFound ? [] : ['No MX records found. Email cannot be delivered to this domain.'],
    });
  } catch {
    records.push({ type: 'MX', domain, value: '', found: false, valid: false, issues: ['Could not check MX records'] });
  }

  // Check SPF record
  try {
    const spfRes = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`);
    const spfData = await spfRes.json();
    const txtRecords = spfData.Answer ? spfData.Answer.map((a: any) => a.data) : [];
    const spfRecord = txtRecords.find((t: string) => t.startsWith('v=spf1'));
    
    if (spfRecord) {
      const hasAll = spfRecord.includes('-all') || spfRecord.includes('~all');
      records.push({
        type: 'SPF',
        domain,
        value: spfRecord,
        found: true,
        valid: hasAll,
        issues: hasAll ? [] : ['SPF record should end with -all (hard fail) or ~all (soft fail) to prevent spoofing'],
      });
    } else {
      records.push({
        type: 'SPF', domain, value: '', found: false, valid: false,
        issues: ['No SPF record found. Emails may be marked as spam. Add an SPF record.'],
      });
    }
  } catch {
    records.push({ type: 'SPF', domain, value: '', found: false, valid: false, issues: ['Could not check SPF record'] });
  }

  // Check DKIM record (common selectors)
  for (const selector of ['default', 'google', 'dkim', 'mail', 'smtp', 'selector1', '2024', '2025', '2026']) {
    try {
      const dkimRes = await fetch(`https://dns.google/resolve?name=${selector}._domainkey.${domain}&type=TXT`);
      const dkimData = await dkimRes.json();
      const dkimFound = dkimData.Answer && dkimData.Answer.length > 0;
      if (dkimFound) {
        const dkimValue = dkimData.Answer[0].data;
        records.push({
          type: 'DKIM',
          domain: `${selector}._domainkey.${domain}`,
          value: dkimValue,
          found: true,
          valid: dkimValue.includes('v=DKIM1') || dkimValue.includes('k=rsa'),
          issues: dkimValue.includes('v=DKIM1') ? [] : ['DKIM record should include v=DKIM1 tag'],
        });
        break; // Found at least one DKIM
      }
    } catch {
      // Continue to next selector
    }
  }

  if (!records.find(r => r.type === 'DKIM' && r.found)) {
    records.push({
      type: 'DKIM', domain: `${domain} (any selector)`, value: '', found: false, valid: false,
      issues: ['No DKIM record found. DKIM signing improves deliverability significantly.'],
    });
  }

  // Check DMARC record
  try {
    const dmarcRes = await fetch(`https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`);
    const dmarcData = await dmarcRes.json();
    const dmarcRecords = dmarcData.Answer ? dmarcData.Answer.map((a: any) => a.data) : [];
    const dmarcRecord = dmarcRecords.find((t: string) => t.startsWith('v=DMARC1'));
    
    if (dmarcRecord) {
      const hasPolicy = dmarcRecord.includes('p=quarantine') || dmarcRecord.includes('p=reject');
      records.push({
        type: 'DMARC',
        domain: `_dmarc.${domain}`,
        value: dmarcRecord,
        found: true,
        valid: hasPolicy,
        issues: hasPolicy ? [] : ['DMARC policy should be p=quarantine or p=reject for best protection'],
      });
    } else {
      records.push({
        type: 'DMARC', domain: `_dmarc.${domain}`, value: '', found: false, valid: false,
        issues: ['No DMARC record found. DMARC prevents spoofing and improves deliverability.'],
      });
    }
  } catch {
    records.push({ type: 'DMARC', domain: `_dmarc.${domain}`, value: '', found: false, valid: false, issues: ['Could not check DMARC record'] });
  }

  return records;
}

/**
 * Analyze email content for spam triggers
 */
export function analyzeSpamScore(html: string, subject: string, fromDomain: string): SpamScoreResult {
  const checks: SpamScoreResult['checks'] = [];
  let totalScore = 0;
  const maxScore = 100;
  const suggestions: string[] = [];

  // 1. Spam trigger words in subject
  const subjectLower = subject.toLowerCase();
  const subjectTriggers = SPAM_TRIGGER_WORDS.filter(w => subjectLower.includes(w));
  checks.push({
    name: 'Subject spam words',
    passed: subjectTriggers.length === 0,
    weight: 20,
    detail: subjectTriggers.length > 0
      ? `Found spam trigger words in subject: ${subjectTriggers.join(', ')}`
      : 'No spam trigger words in subject',
  });
  if (!checks[checks.length - 1].passed) {
    totalScore += 20;
    suggestions.push(`Remove spam trigger words from subject: ${subjectTriggers.join(', ')}`);
  }

  // 2. All-caps in subject
  const hasAllCaps = subject !== subject.toLowerCase() && subject === subject.toUpperCase();
  checks.push({
    name: 'Excessive capitalization',
    passed: !hasAllCaps,
    weight: 10,
    detail: hasAllCaps ? 'Subject is in ALL CAPS' : 'Subject has normal capitalization',
  });
  if (hasAllCaps) { totalScore += 10; suggestions.push('Avoid ALL CAPS in subject line'); }

  // 3. Multiple exclamation marks
  const exclCount = (subject.match(/!/g) || []).length;
  checks.push({
    name: 'Excessive punctuation',
    passed: exclCount <= 1,
    weight: 5,
    detail: exclCount > 1 ? `${exclCount} exclamation marks found` : 'Punctuation looks good',
  });
  if (exclCount > 1) { totalScore += 5; suggestions.push('Reduce exclamation marks in subject'); }

  // 4. HTML-to-text ratio
  const textContent = html.replace(/<[^>]*>/g, '').trim();
  const ratio = html.length > 0 ? textContent.length / html.length : 0;
  checks.push({
    name: 'HTML-to-text ratio',
    passed: ratio > 0.3 && ratio < 0.9,
    weight: 15,
    detail: `${Math.round(ratio * 100)}% text content (ideal: 30-90%)`,
  });
  if (ratio <= 0.3) { totalScore += 15; suggestions.push('Add more text content — too much HTML looks suspicious'); }
  if (ratio >= 0.9) { totalScore += 15; suggestions.push('Add some HTML formatting — plain text can look unprofessional'); }

  // 5. Images without alt text
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const imgsWithoutAlt = imgTags.filter(img => !img.includes('alt='));
  checks.push({
    name: 'Images with alt text',
    passed: imgsWithoutAlt.length === 0,
    weight: 5,
    detail: imgsWithoutAlt.length > 0 ? `${imgsWithoutAlt.length} images missing alt text` : 'All images have alt text',
  });
  if (imgsWithoutAlt.length > 0) { totalScore += 5; suggestions.push('Add alt attributes to all images'); }

  // 6. Suspicious links (URL shorteners, suspicious TLDs)
  const links = html.match(/https?:\/\/[^\s"'>]+/gi) || [];
  const suspiciousLinks = links.filter(l => {
    const tld = '.' + l.split('.').pop()?.split('/')[0];
    return SUSPICIOUS_TLDS.includes(tld) || l.includes('bit.ly') || l.includes('tinyurl') || l.includes('shorturl');
  });
  checks.push({
    name: 'Suspicious links',
    passed: suspiciousLinks.length === 0,
    weight: 15,
    detail: suspiciousLinks.length > 0 ? `Found ${suspiciousLinks.length} suspicious links` : 'All links look clean',
  });
  if (suspiciousLinks.length > 0) { totalScore += 15; suggestions.push('Remove suspicious URL shorteners and unusual TLDs'); }

  // 7. Personalization
  const hasPersonalization = html.includes('{{firstName}}') || html.includes('{{fullName}}') || html.includes('{{email}}');
  checks.push({
    name: 'Personalization',
    passed: hasPersonalization,
    weight: 10,
    detail: hasPersonalization ? 'Email includes personalization' : 'No personalization detected — higher spam risk',
  });
  if (!hasPersonalization) { totalScore += 10; suggestions.push('Add personalization ({{firstName}}, {{company}}) to improve engagement'); }

  // 8. Unsubscribe link
  const hasUnsub = html.toLowerCase().includes('unsubscribe');
  checks.push({
    name: 'Unsubscribe link',
    passed: hasUnsub,
    weight: 10,
    detail: hasUnsub ? 'Unsubscribe link found (CAN-SPAM compliant)' : 'No unsubscribe link — required by law',
  });
  if (!hasUnsub) { totalScore += 10; suggestions.push('Add an unsubscribe link — required by CAN-SPAM law'); }

  // 9. From domain quality
  const isFreeDomain = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'].some(d => fromDomain.includes(d));
  checks.push({
    name: 'Sender domain',
    passed: !isFreeDomain,
    weight: 10,
    detail: isFreeDomain ? 'Sending from free email provider — high spam risk' : `Sending from ${fromDomain} — looks professional`,
  });
  if (isFreeDomain) { totalScore += 10; suggestions.push('Use a custom domain to send emails, not a free provider'); }

  const isSpam = totalScore >= 50;

  return {
    score: totalScore,
    maxScore,
    isSpam,
    checks,
    suggestions: isSpam ? suggestions : [],
  };
}

/**
 * Classify a bounced email for proper handling
 */
export function classifyBounce(email: string, errorMessage: string): BounceClassification {
  const lower = errorMessage.toLowerCase();

  // Hard bounces — permanent failures
  if (lower.includes('user unknown') || lower.includes('does not exist') ||
      lower.includes('no such user') || lower.includes('invalid recipient') ||
      lower.includes('address rejected') || lower.includes('mailbox not found') ||
      lower.includes('invalid email') || lower.includes('invalid address') ||
      lower.includes('no mailbox') || lower.includes('550 5.1.1')) {
    return { email, type: 'hard', reason: 'Email address does not exist', shouldRemove: true };
  }

  // Blocked by recipient server
  if (lower.includes('blocked') || lower.includes('blacklisted') || lower.includes('rejected') ||
      lower.includes('spam detected') || lower.includes('denied') || lower.includes('policy') ||
      lower.includes('550 5.7.1')) {
    return { email, type: 'blocked', reason: 'Blocked by recipient mail server', shouldRemove: false };
  }

  // Soft bounces — temporary issues
  if (lower.includes('mailbox full') || lower.includes('quota exceeded') ||
      lower.includes('try again') || lower.includes('temporarily') ||
      lower.includes('too many connections') || lower.includes('rate limit') ||
      lower.includes('try later') || lower.includes('busy') ||
      lower.includes('450') || lower.includes('452')) {
    return { email, type: 'soft', reason: 'Temporary delivery failure - will retry', shouldRemove: false };
  }

  return { email, type: 'unknown', reason: errorMessage.slice(0, 100), shouldRemove: false };
}

/**
 * Calculate sender reputation score based on sending history
 */
export function calculateReputation(stats: {
  totalSent: number;
  totalBounced: number;
  totalComplaints: number;
  totalOpens: number;
  totalClicks: number;
}): SenderReputation {
  const warnings: string[] = [];

  const bounceRate = stats.totalSent > 0 ? (stats.totalBounced / stats.totalSent) * 100 : 0;
  const complaintRate = stats.totalSent > 0 ? (stats.totalComplaints / stats.totalSent) * 100 : 0;
  const engagementRate = stats.totalSent > 0 ? ((stats.totalOpens + stats.totalClicks) / stats.totalSent) * 100 : 0;

  if (bounceRate > 5) warnings.push(`High bounce rate (${bounceRate.toFixed(1)}%). Should be under 5%. Verify emails before sending.`);
  if (bounceRate > 10) warnings.push(`Bounce rate exceeds 10% — ISPs may start blocking your emails.`);
  if (complaintRate > 0.1) warnings.push(`Complaint rate (${complaintRate.toFixed(2)}%) exceeds 0.1% threshold.`);
  if (engagementRate < 10) warnings.push(`Low engagement rate (${engagementRate.toFixed(1)}%). Improve targeting and content.`);
  if (stats.totalSent < 100) warnings.push('Low sending volume — mailbox providers have limited reputation data');

  let score: SenderReputation['score'];
  if (bounceRate < 2 && complaintRate < 0.05 && engagementRate > 30) score = 'excellent';
  else if (bounceRate < 5 && complaintRate < 0.1 && engagementRate > 15) score = 'good';
  else if (bounceRate < 8 && complaintRate < 0.2 && engagementRate > 10) score = 'fair';
  else if (bounceRate < 15 && complaintRate < 0.5) score = 'poor';
  else score = 'critical';

  return {
    bounceRate,
    complaintRate,
    spamRate: complaintRate,
    engagementRate,
    score,
    warnings,
  };
}

/**
 * Get best time to send emails based on open rate patterns
 */
export function getBestSendTimes(): { day: string; hour: number; score: number }[] {
  // Industry-standard optimal send times
  const bestTimes = [
    { day: 'Tuesday', hour: 10, score: 95 },
    { day: 'Tuesday', hour: 14, score: 90 },
    { day: 'Thursday', hour: 10, score: 92 },
    { day: 'Thursday', hour: 14, score: 88 },
    { day: 'Wednesday', hour: 10, score: 85 },
    { day: 'Wednesday', hour: 14, score: 82 },
    { day: 'Tuesday', hour: 8, score: 80 },
    { day: 'Thursday', hour: 8, score: 78 },
    { day: 'Wednesday', hour: 8, score: 75 },
    { day: 'Tuesday', hour: 6, score: 70 },
  ];
  return bestTimes;
}