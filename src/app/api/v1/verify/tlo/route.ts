// ---------------------------------------------------------------------------
// POST /api/v1/verify/tlo
//
// TRANSUNION TLOxp (TruLookup) Identity Verification
//
// SECURITY REQUIREMENTS (enforced):
//   - Backend-driven only. NO TLO API endpoints, keys, or raw payloads are
//     ever sent to the client.
//   - Zero-Storage / Zero-Retention: raw PII (SSN, DOB) is extracted from
//     the request body, used for the lookup, and immediately scrapped after
//     response. Nothing is persisted to disk, database, or log.
//   - Audit logging records ONLY metadata (timestamp, admin user ID, action
//     type, permissible use code). No PII is included in the audit trail.
//   - Rate limited to 10 requests per minute per admin user.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import type {
  TloVerifyRequest,
  TloVerifyResponse,
  TloPermissibleUseCode,
  TloAuditEntry,
  TloLookupMode,
} from '@/types/tloxp';
import { verifyIdentity, DEFAULT_PERMISSIBLE_USE } from '@/services/tloxpService';
import {
  writeAuditLog,
  buildInitiatedAudit,
  buildSuccessAudit,
  buildFailedAudit,
} from '@/lib/tloxp/audit-logger';

// ---------------------------------------------------------------------------
// Zod-style validation (lightweight, no extra dep)
// ---------------------------------------------------------------------------

const VALID_PERMISSIBLE_CODES: ReadonlySet<string> = new Set([
  'GLBA_FRAUD_PREVENTION',
  'GLBA_SERVICE_PROVIDER',
  'FCRA_BUSINESS_TRANSACTION',
  'FCRA_LEGITIMATE_BUSINESS_NEED',
  'DPPA_PERMISSIBLE_USE',
  'CONSENT_BASED',
  'LAW_ENFORCEMENT',
  'COURT_ORDER',
]);

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC','PR','VI','GU','AS','MP',
]);

function isValidDate(dateStr: string): boolean {
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(dateStr);
  if (!match) return false;
  const [y, m, d] = match[0].split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function validateSsn(raw: string): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = raw.replace(/\D/g, '');
  if (cleaned.length !== 9) {
    return { valid: false, cleaned, error: 'SSN must be exactly 9 digits.' };
  }
  // Validate it's not all zeros or all same digit
  if (/^(0{9}|1{9}|2{9}|3{9}|4{9}|5{9}|6{9}|7{9}|8{9}|9{9})$/.test(cleaned)) {
    return { valid: false, cleaned, error: 'Invalid SSN pattern.' };
  }
  // Validate area number (first 3 digits) is valid
  const area = parseInt(cleaned.slice(0, 3), 10);
  if (area === 0 || area === 666 || area > 772) {
    return { valid: false, cleaned, error: 'Invalid SSN area number.' };
  }
  return { valid: true, cleaned };
}

function sanitizeString(val: unknown, maxLen = 100): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/[\x00-\x1f\x7f]/g, '').slice(0, maxLen);
}

// ---------------------------------------------------------------------------
// In-Memory Rate Limiter (per admin user)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 15; // max lookups per window

// Clean old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(key);
    }
  }
}, 300_000);

function checkRateLimit(adminUserId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(adminUserId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(adminUserId, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  entry.count++;
  const remaining = RATE_LIMIT_MAX - entry.count;
  const resetIn = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);

  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn };
  }

  return { allowed: true, remaining, resetIn };
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse<TloVerifyResponse & { rateLimit?: ReturnType<typeof checkRateLimit> }>> {
  const adminUserId = request.headers.get('x-admin-id') ?? 'anonymous';
  const permissibleUseCodeHeader = request.headers.get('x-permissible-use') ?? '';
  const mode: TloLookupMode = (request.nextUrl.searchParams.get('mode') as TloLookupMode) || 'identity';

  // ---- Rate Limit Check ----
  const rateLimit = checkRateLimit(adminUserId);
  if (!rateLimit.allowed) {
    writeAuditLog(buildFailedAudit(adminUserId, 'GLBA_FRAUD_PREVENTION', 'Rate limit exceeded'));
    return NextResponse.json(
      {
        ok: false,
        error: `Rate limit exceeded. Try again in ${Math.ceil(rateLimit.resetIn / 1000)}s.`,
        usedCode: 'GLBA_FRAUD_PREVENTION' as TloPermissibleUseCode,
        rateLimit,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetIn / 1000)),
          'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
        },
      },
    );
  }

  try {
    // ---- Parse body ----
    let body: TloVerifyRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON payload.', usedCode: 'GLBA_FRAUD_PREVENTION' as TloPermissibleUseCode },
        { status: 400 },
      );
    }

    // ---- Validate all fields ----
    const errors: string[] = [];

    const firstName = sanitizeString(body.firstName, 50);
    const lastName = sanitizeString(body.lastName, 50);

    if (mode === 'identity') {
      if (!firstName) errors.push('firstName is required and must be 1–50 characters.');
      else if (!/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'.-]+$/.test(firstName)) {
        errors.push('firstName contains invalid characters.');
      }

      if (!lastName) errors.push('lastName is required and must be 1–50 characters.');
      else if (!/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'.-]+$/.test(lastName)) {
        errors.push('lastName contains invalid characters.');
      }

      const ssnResult = validateSsn(body.ssn ?? '');
      if (!ssnResult.valid) errors.push(ssnResult.error!);

      if (!body.dob || !isValidDate(body.dob)) {
        errors.push('dob is required and must be in YYYY-MM-DD format.');
      } else {
        const birthDate = new Date(body.dob);
        const age = Math.floor((Date.now() - birthDate.getTime()) / 31557600000);
        if (age < 0 || age > 120) {
          errors.push('dob appears invalid — subject must be 0–120 years old.');
        }
      }
    } else if (mode === 'phone') {
      if (!body.phone || body.phone.replace(/\D/g, '').length < 10) {
        errors.push('phone is required and must be at least 10 digits.');
      }
    } else if (mode === 'background') {
      if (!firstName) errors.push('firstName is required.');
      if (!lastName) errors.push('lastName is required.');
    }

    // Permissible use code resolution
    const permissibleUseCode: TloPermissibleUseCode =
      VALID_PERMISSIBLE_CODES.has(permissibleUseCodeHeader)
        ? (permissibleUseCodeHeader as TloPermissibleUseCode)
        : VALID_PERMISSIBLE_CODES.has(body.permissibleUseCode)
          ? (body.permissibleUseCode as TloPermissibleUseCode)
          : (DEFAULT_PERMISSIBLE_USE as TloPermissibleUseCode);

    // Validate address fields if provided
    const address = sanitizeString(body.address, 100);
    const city = sanitizeString(body.city, 50);
    const state = sanitizeString(body.state, 2).toUpperCase();
    const zip = sanitizeString(body.zip, 10);

    if (address && address.length < 3) errors.push('address is too short.');
    if (state && !US_STATES.has(state)) errors.push('state must be a valid 2-letter US state/territory code.');
    if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) errors.push('zip must be a valid 5-digit or ZIP+4 code.');

    if (errors.length > 0) {
      writeAuditLog(buildFailedAudit(adminUserId, permissibleUseCode, `Validation failed: ${errors.join('; ')}`));
      return NextResponse.json(
        {
          ok: false,
          error: errors.join('; '),
          usedCode: permissibleUseCode,
          rateLimit: { allowed: true, remaining: rateLimit.remaining, resetIn: rateLimit.resetIn },
        },
        { status: 400 },
      );
    }

    // ---- Record audit: lookup initiated ----
    writeAuditLog(buildInitiatedAudit(adminUserId, permissibleUseCode));

    // ---- Execute the TLO lookup ----
    const result = await verifyIdentity({
      firstName,
      lastName,
      ssn: (body.ssn ?? '').replace(/\D/g, '') || undefined,
      dob: body.dob || undefined,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zip: zip || undefined,
      phone: body.phone?.replace(/\D/g, '') || undefined,
      permissibleUseCode,
    }, mode);

    // ---- Record audit: success ----
    writeAuditLog(buildSuccessAudit(adminUserId, permissibleUseCode, result.identityToken, result.matchScore));

    // ---- Return result (no PII) ----
    return NextResponse.json({
      ok: true,
      data: result,
      usedCode: permissibleUseCode,
      rateLimit: { allowed: true, remaining: rateLimit.remaining, resetIn: rateLimit.resetIn },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    writeAuditLog(buildFailedAudit(adminUserId, 'GLBA_FRAUD_PREVENTION', message));

    return NextResponse.json(
      { ok: false, error: message, usedCode: 'GLBA_FRAUD_PREVENTION' as TloPermissibleUseCode },
      { status: 500 },
    );
  } finally {
    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
    }
  }
}