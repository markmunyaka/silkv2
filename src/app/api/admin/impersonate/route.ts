import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// GET /api/admin/impersonate?userId=xxx
// Returns the user's data as if they were logged in (GOD mode)
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'userId is required.' }, { status: 400 });
    }

    // Get user with file count
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 });
    }

    // Get their files
    const files = await prisma.file.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      ok: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          credits: user.credits,
          isSubscribed: user.isSubscribed,
          subscriptionPlan: user.subscriptionPlan,
          createdAt: user.createdAt,
        },
        stats: {
          totalFiles: files.length,
          videosGenerated: files.filter((f) => f.videoUrl).length,
        },
        recentFiles: files.map((f) => ({
          id: f.id,
          fileName: f.fileName,
          summary: f.summary.slice(0, 200),
          hasVideo: !!f.videoUrl,
          createdAt: f.createdAt,
        })),
        recentVideos: [],
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/admin/impersonate]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}