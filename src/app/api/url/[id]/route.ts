import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const link = await prisma.shortenedUrl.findUnique({ where: { id } });
    if (!link) {
      return NextResponse.json(
        { ok: false, error: 'Link not found' },
        { status: 404 },
      );
    }

    await prisma.shortenedUrl.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[URL Delete Error]', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to delete link' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { originalUrl, shortCode, title, expiresAt, isActive } = body as {
      originalUrl?: string;
      shortCode?: string;
      title?: string;
      expiresAt?: string | null;
      isActive?: boolean;
    };

    const link = await prisma.shortenedUrl.findUnique({ where: { id } });
    if (!link) {
      return NextResponse.json(
        { ok: false, error: 'Link not found' },
        { status: 404 },
      );
    }

    // If changing the shortCode, check uniqueness
    if (shortCode && shortCode !== link.shortCode) {
      if (!/^[a-zA-Z0-9_-]{3,16}$/.test(shortCode)) {
        return NextResponse.json(
          { ok: false, error: 'Custom code must be 3-16 alphanumeric characters (hyphens and underscores allowed)' },
          { status: 400 },
        );
      }
      const existing = await prisma.shortenedUrl.findUnique({ where: { shortCode } });
      if (existing) {
        return NextResponse.json(
          { ok: false, error: 'Short code already taken' },
          { status: 409 },
        );
      }
    }

    const updateData: Record<string, any> = {};
    if (originalUrl !== undefined) {
      if (typeof originalUrl === 'string' && originalUrl.trim()) {
        try {
          const parsed = new URL(originalUrl);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('Invalid protocol');
          }
          updateData.originalUrl = originalUrl.trim();
        } catch {
          return NextResponse.json(
            { ok: false, error: 'Invalid URL. Must start with http:// or https://' },
            { status: 400 },
          );
        }
      }
    }
    if (shortCode !== undefined) {
      updateData.shortCode = shortCode;
    }
    if (title !== undefined) {
      updateData.title = title || null;
    }
    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const updated = await prisma.shortenedUrl.update({
      where: { id },
      data: updateData,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.headers.get('origin') || 'http://localhost:3000';

    return NextResponse.json({
      ok: true,
      data: {
        id: updated.id,
        shortCode: updated.shortCode,
        shortUrl: `${baseUrl}/s/${updated.shortCode}`,
        originalUrl: updated.originalUrl,
        title: updated.title,
        clicks: updated.clicks,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
        lastClickedAt: updated.lastClickedAt?.toISOString() ?? null,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[URL Update Error]', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to update link' },
      { status: 500 },
    );
  }
}