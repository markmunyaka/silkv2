/**
 * Video Storage & Watermark Service — Silk Road V2
 *
 * Handles:
 * 1. Downloading the generated MP4 from the temporary Kling URL to local/S3 storage.
 * 2. Applying a "Silk Road V2" watermark overlay (client-side via canvas).
 * 3. Persisting video metadata to the database via Prisma.
 */

import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaveVideoResult {
  id: string;
  taskId: string;
  status: string;
  savedFilePath: string | null;
  watermarked: boolean;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Directory where downloaded MP4s are saved (relative to project root). */
const VIDEO_STORAGE_DIR = 'public/uploads/videos';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist a video generation record to the database.
 * Called when a task is first submitted, so we have a DB row to track it.
 */
export async function persistVideoTask(params: {
  userId: string;
  taskId: string;
  prompt: string;
  fileId?: string;
}): Promise<{ id: string }> {
  const record = await prisma.videoGeneration.create({
    data: {
      userId: params.userId,
      taskId: params.taskId,
      prompt: params.prompt,
      status: 'queued',
      fileId: params.fileId ?? null,
    },
  });
  return { id: record.id };
}

/**
 * Update the video generation record with success data.
 * Saves the Kling URL, thumbnail, source URL, and URL expiry.
 */
export async function updateVideoSuccess(params: {
  taskId: string;
  videoUrl: string;
  thumbnailUrl?: string;
}): Promise<void> {
  // Kling temp URLs typically expire in ~24 hours
  const urlExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.videoGeneration.update({
    where: { taskId: params.taskId },
    data: {
      status: 'succeeded',
      videoUrl: params.videoUrl,
      thumbnailUrl: params.thumbnailUrl ?? null,
      sourceUrl: params.videoUrl,
      urlExpiresAt,
    },
  });
}

/**
 * Update the video generation record with failure data.
 */
export async function updateVideoFailure(params: {
  taskId: string;
  errorMessage: string;
}): Promise<void> {
  await prisma.videoGeneration.update({
    where: { taskId: params.taskId },
    data: {
      status: 'failed',
      errorMessage: params.errorMessage,
    },
  });
}

/**
 * Download the video from the Kling temp URL and save it locally,
 * then mark it as watermarked.
 *
 * NOTE: True server-side FFmpeg watermarking requires the `fluent-ffmpeg` package.
 * This implementation downloads the file and records the local path.
 * The watermark is applied client-side via CSS/Canvas overlay when *displaying* the video.
 *
 * For a production server-side watermark, install fluent-ffmpeg + ffmpeg binaries.
 */
export async function downloadAndSaveVideo(params: {
  taskId: string;
  videoUrl: string;
}): Promise<{ savedFilePath: string }> {
  try {
    const fs = require('fs');
    const path = require('path');
    const { pipeline } = require('stream/promises');

    // Ensure the storage directory exists
    const storageDir = path.resolve(process.cwd(), VIDEO_STORAGE_DIR);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    // Download the video from Kling's temp URL
    const response = await fetch(params.videoUrl);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }

    // Save as taskId.mp4
    const fileName = `${params.taskId}.mp4`;
    const filePath = path.join(storageDir, fileName);
    const writeStream = fs.createWriteStream(filePath);

    await pipeline(response.body, writeStream);

    // Relative path for web access (served from public/)
    const relativePath = `/uploads/videos/${fileName}`;

    // Update DB with saved path and mark as watermarked
    await prisma.videoGeneration.update({
      where: { taskId: params.taskId },
      data: {
        savedFilePath: relativePath,
        watermarked: true,
      },
    });

    return { savedFilePath: relativePath };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown download error';
    console.error(`[VideoStorage] Download failed for task ${params.taskId}:`, message);
    throw error;
  }
}

/**
 * Get video generation record by taskId.
 */
export async function getVideoByTaskId(taskId: string) {
  return prisma.videoGeneration.findUnique({
    where: { taskId },
  });
}

/**
 * Get all video generations for a user.
 */
export async function getUserVideos(userId: string) {
  return prisma.videoGeneration.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}