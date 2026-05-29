import { NextRequest, NextResponse } from 'next/server';
import { validatePhone, type PhoneValidationResult } from '@/services/phoneIntelligenceService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidatePhoneRequest {
  phone?: string;
  workspaceId?: string;
}

interface ValidatePhoneResponse {
  ok: boolean;
  data: {
    phone: string;
    isValid: boolean;
    internationalFormat: string;
    localFormat: string;
    countryCode: string;
    countryName: string;
    countryPrefix: string;
    location: string;
    carrier: string;
    lineType: string;
    reason: string;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

/**
 * POST /api/leads/validate/phone
 *
 * Accepts a JSON payload with `phone` and optional `workspaceId`.
 * Validates and enriches the phone number via Abstract API.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ValidatePhoneResponse>> {
  try {
    let body: ValidatePhoneRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON payload.' } as ValidatePhoneResponse,
        { status: 400 },
      );
    }

    const { phone, workspaceId } = body;

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: phone.' } as ValidatePhoneResponse,
        { status: 400 },
      );
    }

    const result: PhoneValidationResult = await validatePhone(phone);

    const responseData = {
      phone: result.phone,
      isValid: result.isValid,
      internationalFormat: result.internationalFormat,
      localFormat: result.localFormat,
      countryCode: result.countryCode,
      countryName: result.countryName,
      countryPrefix: result.countryPrefix,
      location: result.location,
      carrier: result.carrier,
      lineType: result.lineType,
      reason: result.reason,
    };

    if (result.isValid) {
      return NextResponse.json({ ok: true, data: responseData });
    }

    return NextResponse.json(
      { ok: false, data: responseData, error: result.reason },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/leads/validate/phone] Unhandled error:', error);
    return NextResponse.json(
      { ok: false, error: message } as ValidatePhoneResponse,
      { status: 500 },
    );
  }
}

/**
 * GET /api/leads/validate/phone?phone=...
 * Quick validation via query param (curl-friendly).
 */
export async function GET(request: NextRequest): Promise<NextResponse<ValidatePhoneResponse>> {
  try {
    const phone = request.nextUrl.searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { ok: false, error: 'Missing query parameter: phone.' } as ValidatePhoneResponse,
        { status: 400 },
      );
    }

    const result: PhoneValidationResult = await validatePhone(phone);

    const responseData = {
      phone: result.phone,
      isValid: result.isValid,
      internationalFormat: result.internationalFormat,
      localFormat: result.localFormat,
      countryCode: result.countryCode,
      countryName: result.countryName,
      countryPrefix: result.countryPrefix,
      location: result.location,
      carrier: result.carrier,
      lineType: result.lineType,
      reason: result.reason,
    };

    if (result.isValid) {
      return NextResponse.json({ ok: true, data: responseData });
    }

    return NextResponse.json(
      { ok: false, data: responseData, error: result.reason },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/leads/validate/phone] Unhandled error:', error);
    return NextResponse.json(
      { ok: false, error: message } as ValidatePhoneResponse,
      { status: 500 },
    );
  }
}