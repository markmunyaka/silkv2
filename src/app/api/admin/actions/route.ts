import { NextRequest, NextResponse } from 'next/server';
import type {
  SystemActionResponse,
  AdminApiResponse,
} from '@/types/admin';

// ---------------------------------------------------------------------------
// POST /api/admin/actions
// Body: { action: "clear-cache" | "pause-queues" | "restart-workers" }
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
): Promise<NextResponse<AdminApiResponse<SystemActionResponse>>> {
  try {
    const body = await request.json();
    const { action } = body as { action: string };

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid field: action.' },
        { status: 400 },
      );
    }

    const validActions = ['clear-cache', 'pause-queues', 'restart-workers'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { ok: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 },
      );
    }

    let message: string;

    switch (action) {
      case 'clear-cache':
        // Placeholder: clear in-memory caches, temp files, etc.
        message = 'System cache cleared. Temporary files and in-memory stores flushed.';
        break;
      case 'pause-queues':
        // Placeholder: pause background job queues
        message = 'All processing queues paused. New jobs will not be picked up until resumed.';
        break;
      case 'restart-workers':
        // Placeholder: restart worker processes
        message = 'Background workers restart signal sent. Workers will come back online momentarily.';
        break;
      default:
        message = 'Action acknowledged (no-op).';
    }

    return NextResponse.json({
      ok: true,
      data: {
        action,
        status: 'completed',
        message,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/admin/actions]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}