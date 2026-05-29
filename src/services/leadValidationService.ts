/**
 * Lead Validation Service — Silk Road V2
 *
 * Validates email addresses with a two-pass approach:
 * 1. Local syntax validation (regex) to filter out obvious junk before hitting the API.
 * 2. External API call to a third‑party email verification provider (Abstract API by default).
 *
 * Environment variables:
 *   EMAIL_VALIDATION_API_KEY  — API key for the external verification provider.
 *   EMAIL_VALIDATION_PROVIDER — Which provider to use (defaults to "abstract").
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailValidationResult {
  /** Whether the email is considered deliverable / valid. */
  isValid: boolean;
  /**
   * Quality / deliverability score between 0 and 1.
   * 1 = perfect, 0 = guaranteed bounce.
   */
  score: number;
  /** Whether the email belongs to a known disposable / burner domain. */
  isDisposable: boolean;
  /** Human‑readable reason for the given verdict (useful for frontend display). */
  reason: string;

  // --- Extended details from the external API ---

  /** The deliverability verdict from the external API. */
  deliverability: 'DELIVERABLE' | 'UNDELIVERABLE' | 'RISKY' | 'UNKNOWN';
  /** Whether the syntax/format is valid. */
  isFormatValid: boolean;
  /** Whether this is a free email provider (gmail, yahoo, etc.). */
  isFreeEmail: boolean;
  /** Whether this is a role-based email (admin@, info@, support@, etc.). */
  isRoleEmail: boolean;
  /** Whether the domain is configured as a catch-all. */
  isCatchallEmail: boolean;
  /** Whether MX records were found for the domain. */
  isMxFound: boolean;
  /** Whether the SMTP handshake succeeded. */
  isSmtpValid: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * RFC 5322–inspired email regex.
 * Catches most structurally invalid addresses without being overly permissive.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/** Basic known disposable domains (kept small to avoid bloat; the API provides a richer list). */
const KNOWN_DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.org',
  'guerrillamail.net',
  '10minutemail.com',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'sharklasers.com',
  'trashmail.com',
  'maildrop.cc',
  'getnada.com',
  'burnermail.io',
  'temp-mail.org',
  'tempmail.net',
  'mailnator.com',
  'mailexpire.com',
  'spambox.us',
  'discard.email',
  'spamgourmet.com',
  'mytemp.email',
  'fakeinbox.com',
  'instantmail.com',
  'tempinbox.com',
  'emailondeck.com',
  'temp-mail.io',
]);

/**
 * Check the email against our local disposable domain list.
 * Runs **before** the external API call to catch burners early.
 */
function isKnownDisposable(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return KNOWN_DISPOSABLE_DOMAINS.has(domain);
}

/** Normalise / sanitise an email string. */
function sanitiseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// External API helpers (Abstract API by default)
// ---------------------------------------------------------------------------

/**
 * Response shape from Abstract API's email validation endpoint.
 * @see https://www.abstractapi.com/email-validation
 */
interface AbstractApiResponse {
  email: string;
  autocorrect: string;
  deliverability: string; // "DELIVERABLE" | "UNDELIVERABLE" | "RISKY" | "UNKNOWN"
  quality_score: number;  // 0.00 – 1.00
  is_valid_format: { value: boolean; text: string };
  is_free_email: { value: boolean; text: string };
  is_disposable_email: { value: boolean; text: string };
  is_role_email: { value: boolean; text: string };
  is_catchall_email: { value: boolean; text: string };
  is_mx_found: { value: boolean; text: string };
  is_smtp_valid: { value: boolean; text: string };
}

/**
 * Call Abstract API's email validation endpoint.
 * Returns a partial result on failure so the caller can still decide.
 */
async function checkWithAbstractApi(email: string): Promise<EmailValidationResult> {
  const apiKey = process.env.EMAIL_VALIDATION_API_KEY ?? '';

  if (!apiKey) {
    console.warn('[LeadValidation] No EMAIL_VALIDATION_API_KEY set; falling back to syntax‑only check.');
    return fallbackSyntaxOnly(email);
  }

  const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error(`[LeadValidation] Abstract API responded with ${response.status}: ${errText}`);
    return fallbackSyntaxOnly(email);
  }

  const data: AbstractApiResponse = await response.json();

  const deliverability = (data.deliverability || 'UNKNOWN') as EmailValidationResult['deliverability'];
  const isDeliverable = deliverability === 'DELIVERABLE';
  const isDisposable = data.is_disposable_email?.value ?? false;
  const score = data.quality_score ?? 0.5;

  let reason: string;
  if (isDeliverable && !isDisposable) {
    reason = 'Email is valid and deliverable.';
  } else if (isDisposable) {
    reason = 'Please use a valid, permanent email address (disposable email detected).';
  } else if (deliverability === 'RISKY') {
    reason = 'Email address appears risky — please verify.';
  } else if (deliverability === 'UNDELIVERABLE') {
    reason = 'Email address is not deliverable.';
  } else {
    reason = 'Could not fully verify this email address.';
  }

  return {
    isValid: isDeliverable && !isDisposable,
    score,
    isDisposable,
    reason,
    // --- Extended details ---
    deliverability,
    isFormatValid: data.is_valid_format?.value ?? false,
    isFreeEmail: data.is_free_email?.value ?? false,
    isRoleEmail: data.is_role_email?.value ?? false,
    isCatchallEmail: data.is_catchall_email?.value ?? false,
    isMxFound: data.is_mx_found?.value ?? false,
    isSmtpValid: data.is_smtp_valid?.value ?? false,
  };
}

/**
 * Return a default "unknown"/"empty" state for all extended fields.
 * Used when the external API was not called (fallback / local-only path).
 */
function emptyExtended(): Pick<
  EmailValidationResult,
  'deliverability' | 'isFormatValid' | 'isFreeEmail' | 'isRoleEmail' | 'isCatchallEmail' | 'isMxFound' | 'isSmtpValid'
> {
  return {
    deliverability: 'UNKNOWN',
    isFormatValid: false,
    isFreeEmail: false,
    isRoleEmail: false,
    isCatchallEmail: false,
    isMxFound: false,
    isSmtpValid: false,
  };
}

/**
 * When the external API is unavailable, perform a best‑effort local validation
 * so the service doesn't hard‑fail.
 *
 * NOTE: This fallback NEVER marks an email as `isValid: true` because we
 * cannot verify deliverability without the external API. It is intentionally
 * conservative to prevent false positives.
 */
function fallbackSyntaxOnly(email: string): EmailValidationResult {
  const syntaxValid = EMAIL_REGEX.test(email);
  const disposable = isKnownDisposable(email);

  if (!syntaxValid) {
    return {
      isValid: false,
      score: 0,
      isDisposable: false,
      reason: 'Invalid email format.',
      ...emptyExtended(),
      isFormatValid: false,
    };
  }

  if (disposable) {
    return {
      isValid: false,
      score: 0.1,
      isDisposable: true,
      reason: 'Please use a valid, permanent email address (disposable email detected).',
      ...emptyExtended(),
      isFormatValid: true,
    };
  }

  // Syntax is valid but we cannot verify deliverability — mark as not valid
  return {
    isValid: false,
    score: 0.5,
    isDisposable: false,
    reason: 'Email format is valid but could not verify deliverability (API unavailable).',
    ...emptyExtended(),
    isFormatValid: true,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate an email address.
 *
 * 1. Sanitise the input.
 * 2. Run local regex syntax check (fail fast if malformed).
 * 3. Check local disposable domain list.
 * 4. Call the external verification API.
 *
 * @param email - The email address to validate.
 * @returns A structured `EmailValidationResult`.
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  // --- Input guard ---
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      score: 0,
      isDisposable: false,
      reason: 'No email address provided.',
      ...emptyExtended(),
    };
  }

  const sanitised = sanitiseEmail(email);

  // --- Pass 1: Local syntax check ---
  if (sanitised.length < 3 || sanitised.length > 320) {
    return {
      isValid: false,
      score: 0,
      isDisposable: false,
      reason: 'Email address length is invalid.',
      ...emptyExtended(),
    };
  }

  if (!EMAIL_REGEX.test(sanitised)) {
    return {
      isValid: false,
      score: 0,
      isDisposable: false,
      reason: 'Invalid email format.',
      ...emptyExtended(),
    };
  }

  // --- Pass 2: Local disposable check (fast) ---
  if (isKnownDisposable(sanitised)) {
    return {
      isValid: false,
      score: 0.1,
      isDisposable: true,
      reason: 'Please use a valid, permanent email address (disposable email detected).',
      ...emptyExtended(),
      isFormatValid: true,
    };
  }

  // --- Pass 3: External API ---
  try {
    return await checkWithAbstractApi(sanitised);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[LeadValidation] External API call failed: ${message}`);
    return fallbackSyntaxOnly(sanitised);
  }
}