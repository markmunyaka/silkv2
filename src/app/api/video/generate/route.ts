/**
 * POST /api/video/generate
 *
 * Submits a text-to-video generation task to Kling AI.
 *
 * Because video rendering can take up to 90 seconds, this endpoint does NOT
 * wait for the result. It submits the task to Kling and immediately returns
 * a `task_id` with `status: "queued"` so the frontend can poll for completion
 * (via `GET /api/video/status?taskId=...`) without blocking the UI.
 *
 * The task is also persisted to the database via `VideoGeneration` model so
 * the user's generated videos are saved and visible across sessions.
 *
 * Request body (JSON):
 *   {
 *     "prompt": "A cinematic aerial shot of...",
 *     "workspaceId": "wksp_abc123",
 *     "duration"?: 5,
 *     "aspect_ratio"?: "16:9",
 *     "fileId"?: "abc123"  // optional link to a File record
 *   }
 *
 * Response (200):
 *   { "ok": true, "data": { "taskId": "...", "status": "queued" } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createVideoTask } from '@/services/klingService';
import { persistVideoTask } from '@/services/videoStorageService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateVideoRequest {
  prompt?: string;
  workspaceId?: string;
  duration?: number;
  aspect_ratio?: string;
  /** Optional link to a File record (e.g. the PDF that was summarized). */
  fileId?: string;
}

interface GenerateVideoResponse {
  ok: boolean;
  data?: {
    taskId: string;
    status: 'queued';
    /** Human-readable message for the frontend. */
    message: string;
    /** Database ID for the video generation record. */
    dbId?: string;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse<GenerateVideoResponse>> {
  try {
    // ---- 1. Parse & validate the request body ----
    let body: GenerateVideoRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON payload. Expected { prompt, workspaceId }.' },
        { status: 400 },
      );
    }

    const { prompt, workspaceId, duration, aspect_ratio, fileId } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Missing or empty required field: `prompt`.' },
        { status: 400 },
      );
    }

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: `workspaceId`.' },
        { status: 400 },
      );
    }

    // ---- 2. Submit the task to Kling ----
    const { taskId } = await createVideoTask(prompt, {
      duration,
      aspect_ratio,
    });

    // ---- 3. Persist to database ----
    const { id: dbId } = await persistVideoTask({
      userId: workspaceId,
      taskId,
      prompt: prompt.trim(),
      fileId,
    });

    // ---- 4. Return immediately with the task_id ----
    return NextResponse.json({
      ok: true,
      data: {
        taskId,
        status: 'queued' as const,
        message:
          'Video generation queued. Poll GET /api/video/status?taskId=' +
          `${taskId} to check when rendering completes.`,
        dbId,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/video/generate] Unhandled error:', error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}