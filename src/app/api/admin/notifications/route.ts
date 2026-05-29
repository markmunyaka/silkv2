import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import type { AdminNotification, AdminApiResponse } from '@/types/admin';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// GET /api/admin/notifications
// Returns real notifications sourced from database events
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
): Promise<NextResponse<AdminApiResponse<AdminNotification[]>>> {
  try {
    const notifications: AdminNotification[] = [];

    // 1. Recent user registrations (last 24 hours)
    const recentUsers = await prisma.user.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const user of recentUsers) {
      notifications.push({
        id: `new-user-${user.id}`,
        type: 'info',
        title: 'New user registered',
        message: `${user.name} (${user.email}) just created an account`,
        timestamp: user.createdAt.toISOString(),
        read: false,
      });
    }

    // 2. Video generation completions (last 24 hours)
    const recentVideos = await prisma.videoGeneration.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 86400000) }, status: { in: ['succeeded', 'failed'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { user: { select: { name: true } } },
    });

    for (const video of recentVideos) {
      notifications.push({
        id: `video-${video.id}`,
        type: video.status === 'succeeded' ? 'success' : 'error',
        title: video.status === 'succeeded' ? 'Video generation completed' : 'Video generation failed',
        message: video.status === 'succeeded'
          ? `Summary video for "${video.prompt.slice(0, 60)}${video.prompt.length > 60 ? '…' : ''}" by ${video.user.name} is ready`
          : `Video generation failed for ${video.user.name}: ${video.errorMessage || 'Unknown error'}`,
        timestamp: video.createdAt.toISOString(),
        read: false,
      });
    }

    // 3. Recent file uploads (last 24 hours)
    const recentFiles = await prisma.file.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { user: { select: { name: true } } },
    });

    for (const file of recentFiles) {
      notifications.push({
        id: `file-${file.id}`,
        type: 'info',
        title: 'Document processed',
        message: `"${file.fileName}" was processed by ${file.user.name}`,
        timestamp: file.createdAt.toISOString(),
        read: false,
      });
    }

    // 4. Video generation queued (last hour)
    const queuedVideos = await prisma.videoGeneration.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 3600000) }, status: 'queued' },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { user: { select: { name: true } } },
    });

    for (const video of queuedVideos) {
      notifications.push({
        id: `video-queued-${video.id}`,
        type: 'info',
        title: 'Video generation queued',
        message: `${video.user.name} queued a video: "${video.prompt.slice(0, 50)}${video.prompt.length > 50 ? '…' : ''}"`,
        timestamp: video.createdAt.toISOString(),
        read: false,
      });
    }

    // 5. Check for suspended users (potential issues)
    const suspendedUsers = await prisma.user.findMany({
      where: { status: 'suspended', updatedAt: { gte: new Date(Date.now() - 86400000) } },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    });

    for (const user of suspendedUsers) {
      notifications.push({
        id: `suspended-${user.id}`,
        type: 'warning',
        title: 'Account suspended',
        message: `${user.name} (${user.email}) account was suspended`,
        timestamp: user.updatedAt.toISOString(),
        read: false,
      });
    }

    // Sort all notifications by timestamp descending (newest first)
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit to 20 notifications maximum
    notifications.splice(20);

    return NextResponse.json({ ok: true, data: notifications });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/admin/notifications]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}