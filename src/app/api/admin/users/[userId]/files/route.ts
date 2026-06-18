import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/admin/users/[userId]/files
 * Get all files for a specific user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        credits: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's files
    const [total, files] = await Promise.all([
      prisma.file.count({
        where: {
          userId,
          deletedByAdminAt: null, // Exclude soft-deleted files
        },
      }),
      prisma.file.findMany({
        where: {
          userId,
          deletedByAdminAt: null,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          textLength: true,
          summary: true,
          audioUrl: true,
          videoUrl: true,
          adminNotes: true,
          flagged: true,
          createdAt: true,
          updatedAt: true,
          videoGeneration: {
            select: { id: true, status: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        user,
        files: files.map(f => ({
          id: f.id,
          fileName: f.fileName,
          fileSize: f.fileSize || f.textLength || 0,
          summary: f.summary?.substring(0, 200) || '',
          hasAudio: !!f.audioUrl,
          hasVideo: !!f.videoUrl,
          videoStatus: f.videoGeneration?.status || null,
          adminNotes: f.adminNotes,
          flagged: f.flagged,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        })),
        pagination: { page, pageSize, total },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/admin/users/[userId]/files]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
