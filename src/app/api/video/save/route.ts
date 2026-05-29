/**
 * POST /api/video/save
 *
 * Downloads the generated video from the temporary Kling URL and saves it
 * to local storage before the link expires (typically 24 hours).
 *
 * The "Silk Road V2" watermark is marked as applied in the database.
 * The actual watermark overlay is rendered client-side via CSS to avoid
 * server-side FFmpeg dependency.
 *
 * Request body (JSON):
 *   {
 *     "taskId": "kling_task_abc123"
 *   }
 *
 * Response (200):
 *   {
 *     "ok": true,
 *     "data": {
 *       "savedFilePath": "/uploads/videos/kling_task_abc123.mp4",
 *       "watermarked": true
 *     }
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVideoByTaskId, downloadAndSaveVideo } from '@/services/videoStorageService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SaveVideoRequest {
  taskId?: string;
}

interface SaveVideoResponse {
  ok: boolean;
  data?: {
    taskId: string;
    savedFilePath: string;
    watermarked: boolean;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse<SaveVideoResponse>> {
  try {
    // ---- 1. Parse & validate the request body ----
    let body: SaveVideoRequest;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON payload. Expected { taskId }.' },
        { status: 400 },
      );
    }

    const { taskId } = body;

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: `taskId`.' },
        { status: 400 },
      );
    }

    // ---- 2. Check the video exists and has a URL ----
    const video = await getVideoByTaskId(taskId);

    if (!video) {
      return NextResponse.json(
        { ok: false, error: `No video generation record found for taskId: ${taskId}` },
        { status: 404 },
      );
    }

    if (video.status !== 'succeeded') {
      return NextResponse.json(
        { ok: false, error: `Video task status is "${video.status}". Can only save a succeeded video.` },
        { status: 400 },
      );
    }

    if (!video.videoUrl) {
      return NextResponse.json(
        { ok: false, error: 'Video URL is missing. Cannot download.' },
        { status: 400 },
      );
    }

    // ---- 3. Don't re-download if already saved ----
    if (video.savedFilePath) {
      return NextResponse.json({
        ok: true,
        data: {
          taskId: video.taskId,
          savedFilePath: video.savedFilePath,
          watermarked: video.watermarked,
        },
      });
    }

    // ---- 4. Download the video from the Kling temp URL and save locally ----
    const { savedFilePath } = await downloadAndSaveVideo({
      taskId,
      videoUrl: video.videoUrl,
    });

    return NextResponse.json({
      ok: true,
      data: {
        taskId,
        savedFilePath,
        watermarked: true, // marked as watermarked in the download function
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/video/save] Unhandled error:', error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}