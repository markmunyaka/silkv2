import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Missing userId query parameter' },
        { status: 400 },
      );
    }

    const links = await prisma.shortenedUrl.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.headers.get('origin') || 'http://localhost:3000';

    return NextResponse.json({
      ok: true,
      data: links.map((link) => ({
        id: link.id,
        shortCode: link.shortCode,
        shortUrl: `${baseUrl}/s/${link.shortCode}`,
        originalUrl: link.originalUrl,
        title: link.title,
        clicks: link.clicks,
        isActive: link.isActive,
        expiresAt: link.expiresAt?.toISOString() ?? null,
        lastClickedAt: link.lastClickedAt?.toISOString() ?? null,
        createdAt: link.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('[URL My Links Error]', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch links' },
      { status: 500 },
    );
  }
}
