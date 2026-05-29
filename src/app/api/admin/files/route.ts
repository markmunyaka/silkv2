import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import type {
  AdminFileRecord,
  AdminApiResponse,
  PaginatedResponse,
} from '@/types/admin';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// GET /api/admin/files?page=1&pageSize=20&search=
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
): Promise<NextResponse<AdminApiResponse<PaginatedResponse<AdminFileRecord>>>> {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    if (search) {
      where.fileName = { contains: search };
    }

    const [total, raw] = await Promise.all([
      prisma.file.count({ where }),
      prisma.file.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          videoGeneration: { select: { id: true, status: true } },
        },
      }),
    ]);

    const items: AdminFileRecord[] = raw.map((f) => {
      let format: AdminFileRecord['format'] = 'PDF';
      if (f.audioUrl) format = 'Audio';
      else if (f.videoUrl) format = 'Video';

      return {
        id: f.id,
        fileName: f.fileName,
        format,
        sizeBytes: f.originalText.length * 2, // rough byte-size estimate
        ownerName: f.user.name,
        ownerEmail: f.user.email,
        processingStatus: 'completed' as const,
        hasVideo: f.videoGeneration !== null && f.videoGeneration.status === 'succeeded',
        createdAt: f.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      ok: true,
      data: { items, total, page, pageSize },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/admin/files]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}