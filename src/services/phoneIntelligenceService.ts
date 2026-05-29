/**
 * Phone Intelligence Service — Silk Road V2
 *
 * Validates and enriches phone numbers using Abstract API's Phone Validation API.
 * Includes local format validation before hitting the external API.
 *
 * Environment variables:
 *   PHONE_VALIDATION_API_KEY  — API key for Abstract Phone Validation.
 *   (Reuses EMAIL_VALIDATION_API_KEY as fallback if not set separately)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhoneValidationResult {
  /** Whether the phone number is valid and reachable. */
  isValid: boolean;
  /** The raw phone number submitted. */
  phone: string;
  /** Internationally formatted number (e.g., "+1 415-200-7986"). */
  internationalFormat: string;
  /** Locally formatted number (e.g., "415-200-7986"). */
  localFormat: string;
  /** Country code (e.g., "US"). */
  countryCode: string;
  /** Country name (e.g., "United States of America"). */
  countryName: string;
  /** Country dialing prefix (e.g., "+1"). */
  countryPrefix: string;
  /** Geographic location (e.g., "San Francisco, CA"). */
  location: string;
  /** Carrier name (e.g., "AT&T Mobility LLC"). */
  carrier: string;
  /** Line type: "mobile", "landline", "voip", "toll-free", "premium", or "unknown". */
  lineType: 'mobile' | 'landline' | 'voip' | 'toll-free' | 'premium' | 'unknown';
  /** Human‑readable reason. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Basic phone number sanitization.
 * Strips spaces, parentheses, dashes, dots, and leading '+' normalization.
 */
function sanitisePhone(raw: string): string {
  let cleaned = raw.trim();
  // Keep leading + but remove spaces, dashes, dots, parens
  const hasPlus = cleaned.startsWith('+');
  cleaned = cleaned.replace(/[\s\-\(\)\.]/g, '');
  if (hasPlus && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

/**
 * Very basic local format check before hitting the API.
 * At minimum requires 4+ digits.
 */
function basicPhoneCheck(phone: string): { ok: boolean; reason: string } {
  if (!phone || phone.length < 4) {
    return { ok: false, reason: 'Phone number too short.' };
  }
  if (phone.length > 20) {
    return { ok: false, reason: 'Phone number too long.' };
  }
  // Ensure only digits and leading +
  const digitsOnly = phone.replace(/^\+/, '').replace(/\d/g, '');
  if (digitsOnly.length > 0) {
    return { ok: false, reason: 'Phone number contains invalid characters.' };
  }
  return { ok: true, reason: '' };
}

// ---------------------------------------------------------------------------
// External API
// ---------------------------------------------------------------------------

/**
 * Response shape from Abstract API's phone validation endpoint.
 * @see https://www.abstractapi.com/phone-validation
 */
interface AbstractPhoneApiResponse {
  phone: string;
  valid: boolean;
  format: {
    international: string;
    local: string;
  };
  country: {
    code: string;
    name: string;
    prefix: string;
  };
  location: string;
  carrier: string;
  line_type: string; // "mobile" | "landline" | "voip" | "toll-free" | "premium" | null
}

function mapLineType(raw: string | null): PhoneValidationResult['lineType'] {
  switch (raw) {
    case 'mobile': return 'mobile';
    case 'landline': return 'landline';
    case 'voip': return 'voip';
    case 'toll-free': return 'toll-free';
    case 'premium': return 'premium';
    default: return 'unknown';
  }
}

async function checkWithAbstractPhoneApi(phone: string): Promise<PhoneValidationResult> {
  // Try phone-specific key first, fall back to email key
  const apiKey = process.env.PHONE_VALIDATION_API_KEY
    || process.env.EMAIL_VALIDATION_API_KEY
    || '';

  if (!apiKey) {
    console.warn('[PhoneIntelligence] No API key set; falling back to format‑only check.');
    return fallbackPhoneOnly(phone);
  }

  const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${encodeURIComponent(apiKey)}&phone=${encodeURIComponent(phone)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error(`[PhoneIntelligence] Abstract API responded with ${response.status}: ${errText}`);
    return fallbackPhoneOnly(phone);
  }

  const data: AbstractPhoneApiResponse = await response.json();

  const valid = data.valid ?? false;
  const lineType = mapLineType(data.line_type ?? null);

  let reason: string;
  if (valid) {
    reason = `Valid ${lineType} number in ${data.country?.name || 'unknown country'}.`;
  } else {
    reason = 'Phone number is not valid.';
  }

  return {
    isValid: valid,
    phone: data.phone || phone,
    internationalFormat: data.format?.international || phone,
    localFormat: data.format?.local || phone,
    countryCode: data.country?.code || '',
    countryName: data.country?.name || '',
    countryPrefix: data.country?.prefix || '',
    location: data.location || '',
    carrier: data.carrier || '',
    lineType,
    reason,
  };
}

/**
 * Fallback when API is unavailable — uses basic format validation only.
 */
function fallbackPhoneOnly(phone: string): PhoneValidationResult {
  const check = basicPhoneCheck(phone);
  return {
    isValid: check.ok,
    phone,
    internationalFormat: phone,
    localFormat: phone,
    countryCode: '',
    countryName: '',
    countryPrefix: '',
    location: '',
    carrier: '',
    lineType: 'unknown',
    reason: check.ok
      ? 'Phone format is valid (limited verification — no API key).'
      : check.reason,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate and enrich a phone number.
 *
 * 1. Sanitise the input.
 * 2. Run basic local format check (fail fast if malformed).
 * 3. Call the external Phone Validation API.
 *
 * @param phone - The phone number to validate.
 * @returns A structured `PhoneValidationResult`.
 */
export async function validatePhone(phone: string): Promise<PhoneValidationResult> {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      phone: '',
      internationalFormat: '',
      localFormat: '',
      countryCode: '',
      countryName: '',
      countryPrefix: '',
      location: '',
      carrier: '',
      lineType: 'unknown',
      reason: 'No phone number provided.',
    };
  }

  const sanitised = sanitisePhone(phone);

  // Local basic check
  const check = basicPhoneCheck(sanitised);
  if (!check.ok) {
    return {
      isValid: false,
      phone: sanitised,
      internationalFormat: sanitised,
      localFormat: sanitised,
      countryCode: '',
      countryName: '',
      countryPrefix: '',
      location: '',
      carrier: '',
      lineType: 'unknown',
      reason: check.reason,
    };
  }

  // External API
  try {
    return await checkWithAbstractPhoneApi(sanitised);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PhoneIntelligence] External API call failed: ${message}`);
    return fallbackPhoneOnly(sanitised);
  }
}