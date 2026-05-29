import { NextRequest, NextResponse } from 'next/server';
import { validateEmail, type EmailValidationResult } from '@/services/leadValidationService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidateLeadRequest {
  email?: string;
  workspaceId?: string;
}

interface ValidateLeadResponse {
  ok: boolean;
  data: {
    email: string;
    isValid: boolean;
    score: number;
    isDisposable: boolean;
    reason: string;
    deliverability: string;
    isFormatValid: boolean;
    isFreeEmail: boolean;
    isRoleEmail: boolean;
    isCatchallEmail: boolean;
    isMxFound: boolean;
    isSmtpValid: boolean;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

/**
 * POST /api/leads/validate
 *
 * Accepts a JSON payload with `email` and `workspaceId`.
 * Always returns structured data in the `data` field so the frontend
 * can display the full detail panel regardless of valid/invalid status.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ValidateLeadResponse>> {
  try {
    // ---- 1. Parse & validate the request body ----
    let body: ValidateLeadRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON payload.' } as ValidateLeadResponse,
        { status: 400 },
      );
    }

    const { email, workspaceId } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: email.' } as ValidateLeadResponse,
        { status: 400 },
      );
    }

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: workspaceId.' } as ValidateLeadResponse,
        { status: 400 },
      );
    }

    // ---- 2. Run the email through the validation service ----
    const result: EmailValidationResult = await validateEmail(email);

    // ---- 3. Always return structured data — frontend decides how to display ----
    const responseData = {
      email: email.trim().toLowerCase(),
      isValid: result.isValid,
      score: result.score,
      isDisposable: result.isDisposable,
      reason: result.reason,
      deliverability: result.deliverability,
      isFormatValid: result.isFormatValid,
      isFreeEmail: result.isFreeEmail,
      isRoleEmail: result.isRoleEmail,
      isCatchallEmail: result.isCatchallEmail,
      isMxFound: result.isMxFound,
      isSmtpValid: result.isSmtpValid,
    };

    if (result.isValid) {
      return NextResponse.json({ ok: true, data: responseData });
    }

    // Invalid or disposable — return data + error message
    const statusCode = result.isDisposable ? 422 : 400;

    return NextResponse.json(
      { ok: false, data: responseData, error: result.reason || 'Please use a valid, permanent email address.' },
      { status: statusCode },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/leads/validate] Unhandled error:', error);
    return NextResponse.json(
      { ok: false, error: message } as ValidateLeadResponse,
      { status: 500 },
    );
  }
}