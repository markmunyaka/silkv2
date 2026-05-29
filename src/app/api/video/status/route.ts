/**
 * GET /api/video/status?taskId=...
 *
 * Polls the Kling API for the current status of a video generation task.
 * On SUCCEEDED or FAILED, the result is also persisted to the database
 * via the VideoGeneration model.
 *
 * Query parameters:
 *   taskId (required) — The task ID returned by the generate endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkVideoStatus } from '@/services/klingService';
import { updateVideoSuccess, updateVideoFailure } from '@/services/videoStorageService';
import type { KlingTaskStatus } from '@/services/klingService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoStatusResponse {
  ok: boolean;
  data?: {
    taskId: string;
    status: KlingTaskStatus;
    videoUrl?: string;
    thumbnailUrl?: string;
    errorMessage?: string;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse<VideoStatusResponse>> {
  try {
    // ---- 1. Extract the taskId from the query string ----
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required query parameter: `taskId`.' },
        { status: 400 },
      );
    }

    // ---- 2. Poll Kling for the current status ----
    const result = await checkVideoStatus(taskId);

    // ---- 3. Persist terminal states to the database ----
    if (result.status === 'SUCCEEDED' && result.videoUrl) {
      // Fire-and-forget: persist to DB in background, don't block the response
      updateVideoSuccess({
        taskId,
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
      }).catch((err) =>
        console.error(`[Status] Failed to persist success for task ${taskId}:`, err),
      );
    } else if (result.status === 'FAILED') {
      updateVideoFailure({
        taskId,
        errorMessage: result.errorMessage || 'Unknown error',
      }).catch((err) =>
        console.error(`[Status] Failed to persist failure for task ${taskId}:`, err),
      );
    }

    // ---- 4. Return the status payload ----
    return NextResponse.json({
      ok: true,
      data: {
        taskId: result.taskId,
        status: result.status,
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        errorMessage: result.errorMessage,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/video/status] Unhandled error:', error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}