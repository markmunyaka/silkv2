import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/admin/files/download/[id]
 * Download file content as JSON/text
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const file = await prisma.file.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        fileName: true,
        originalText: true,
        summary: true,
        user: {
          select: { email: true, name: true },
        },
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Return as JSON for download
    const downloadData = {
      fileName: file.fileName,
      owner: file.user,
      downloadedAt: new Date().toISOString(),
      content: {
        original: file.originalText,
        summary: file.summary,
      },
    };

    // Mark as downloaded by admin
    await prisma.file.update({
      where: { id: params.id },
      data: { downloadedByAdminAt: new Date() },
    });

    return NextResponse.json(downloadData, {
      headers: {
        'Content-Disposition': `attachment; filename="${file.fileName.replace(/\s+/g, '_')}_export.json"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/admin/files/download/[id]]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
