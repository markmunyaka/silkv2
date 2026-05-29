import { NextRequest, NextResponse } from 'next/server';
import { validateEmail, type EmailValidationResult } from '@/services/leadValidationService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BatchLeadValidationRequest {
  emails: string[];
  workspaceId?: string;
}

interface BatchItemResult {
  email: string;
  isValid: boolean;
  score: number;
  isDisposable: boolean;
  reason: string;
}

interface BatchLeadValidationResponse {
  ok: boolean;
  data?: {
    total: number;
    valid: number;
    invalid: number;
    disposable: number;
    results: BatchItemResult[];
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

/**
 * POST /api/leads/validate/batch
 *
 * Accepts a JSON payload with an array of `emails` and optional `workspaceId`.
 * Validates up to 100 emails in a single request with rate-limit friendly sequential processing.
 */
export async function POST(request: NextRequest): Promise<NextResponse<BatchLeadValidationResponse>> {
  try {
    // ---- 1. Parse & validate the request body ----
    let body: BatchLeadValidationRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON payload.' },
        { status: 400 },
      );
    }

    const { emails, workspaceId } = body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: emails (non-empty array).' },
        { status: 400 },
      );
    }

    if (emails.length > 100) {
      return NextResponse.json(
        { ok: false, error: 'Maximum of 100 emails per batch request.' },
        { status: 400 },
      );
    }

    if (workspaceId && typeof workspaceId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'workspaceId must be a string if provided.' },
        { status: 400 },
      );
    }

    // ---- 2. Validate each email sequentially (avoid flooding Abstract API) ----
    const results: BatchItemResult[] = [];

    for (const rawEmail of emails) {
      if (typeof rawEmail !== 'string') {
        results.push({
          email: String(rawEmail),
          isValid: false,
          score: 0,
          isDisposable: false,
          reason: 'Invalid input type.',
        });
        continue;
      }

      const trimmed = rawEmail.trim();
      if (!trimmed) {
        results.push({
          email: '',
          isValid: false,
          score: 0,
          isDisposable: false,
          reason: 'Empty email string.',
        });
        continue;
      }

      try {
        const result: EmailValidationResult = await validateEmail(trimmed);
        results.push({
          email: trimmed.toLowerCase(),
          isValid: result.isValid,
          score: result.score,
          isDisposable: result.isDisposable,
          reason: result.reason,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[BatchValidate] Error validating "${trimmed}": ${message}`);
        results.push({
          email: trimmed.toLowerCase(),
          isValid: false,
          score: 0,
          isDisposable: false,
          reason: 'Validation error.',
        });
      }
    }

    // ---- 3. Aggregate counts ----
    const valid = results.filter((r) => r.isValid).length;
    const invalid = results.filter((r) => !r.isValid && !r.isDisposable).length;
    const disposable = results.filter((r) => r.isDisposable).length;

    return NextResponse.json({
      ok: true,
      data: {
        total: results.length,
        valid,
        invalid,
        disposable,
        results,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/leads/validate/batch] Unhandled error:', error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}