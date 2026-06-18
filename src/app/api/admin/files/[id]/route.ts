import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/admin/files/[id]
 * Get detailed information about a specific file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const file = await prisma.file.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            credits: true,
            role: true,
          },
        },
        videoGeneration: true,
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: file.id,
        fileName: file.fileName,
        fileSize: file.fileSize || file.originalText.length,
        textLength: file.textLength || file.originalText.length,
        summary: file.summary.substring(0, 500) + '...',
        audioUrl: file.audioUrl,
        videoUrl: file.videoUrl,
        adminNotes: file.adminNotes,
        flagged: file.flagged,
        downloadedByAdminAt: file.downloadedByAdminAt,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
        owner: file.user,
        videoGeneration: file.videoGeneration ? {
          id: file.videoGeneration.id,
          status: file.videoGeneration.status,
        } : null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/admin/files/[id]]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/files/[id]
 * Soft delete a file (marks as deleted but keeps data for audit)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { hardDelete = false } = body as { hardDelete?: boolean };

    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    if (hardDelete) {
      // Permanently delete file
      await prisma.file.delete({
        where: { id },
      });

      return NextResponse.json({
        ok: true,
        message: 'File permanently deleted',
      });
    }

    // Soft delete - mark as deleted but keep data
    await prisma.file.update({
      where: { id },
      data: { deletedByAdminAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      message: 'File marked as deleted',
      deletedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[DELETE /api/admin/files/[id]]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/files/[id]
 * Update file metadata (notes, flags, etc.)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json() as {
      adminNotes?: string;
      flagged?: boolean;
    };

    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.file.update({
      where: { id },
      data: {
        adminNotes: body.adminNotes !== undefined ? body.adminNotes : file.adminNotes,
        flagged: body.flagged !== undefined ? body.flagged : file.flagged,
        downloadedByAdminAt: body.adminNotes !== undefined ? new Date() : file.downloadedByAdminAt,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: updated.id,
        adminNotes: updated.adminNotes,
        flagged: updated.flagged,
        downloadedByAdminAt: updated.downloadedByAdminAt?.toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[PUT /api/admin/files/[id]]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
