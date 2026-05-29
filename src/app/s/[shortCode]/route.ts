import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  try {
    const { shortCode } = await params;

    if (!shortCode || typeof shortCode !== 'string') {
      return NextResponse.json({ error: 'Missing short code' }, { status: 400 });
    }

    const link = await prisma.shortenedUrl.findUnique({
      where: { shortCode },
    });

    if (!link) {
      // Return a custom 404 page hint
      return new Response(
        `<!DOCTYPE html><html><head><title>Link not found</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#050505;color:#fff;flex-direction:column;gap:8px}code{color:gold;font-size:2rem}small{color:#666}</style></head><body><code>🔗</code><h1>404 — Link not found</h1><p>The shortened URL <strong>/s/${shortCode}</strong> doesn't exist.</p><small>Silk Road V2 URL Shortener</small></body></html>`,
        {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
      );
    }

    // Check if the link is inactive
    if (!link.isActive) {
      return new Response(
        `<!DOCTYPE html><html><head><title>Link disabled</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#050505;color:#fff;flex-direction:column;gap:8px}code{font-size:2rem}small{color:#666}</style></head><body><code>⛔</code><h1>410 — Link disabled</h1><p>This shortened URL has been disabled by its owner.</p><small>Silk Road V2 URL Shortener</small></body></html>`,
        {
          status: 410,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
      );
    }

    // Check if the link has expired
    if (link.expiresAt && new Date() > link.expiresAt) {
      return new Response(
        `<!DOCTYPE html><html><head><title>Link expired</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#050505;color:#fff;flex-direction:column;gap:8px}code{font-size:2rem}small{color:#666}</style></head><body><code>⏰</code><h1>410 — Link expired</h1><p>This shortened URL expired on ${link.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p><small>Silk Road V2 URL Shortener</small></body></html>`,
        {
          status: 410,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
      );
    }

    // Increment click count & update lastClickedAt
    await prisma.shortenedUrl.update({
      where: { id: link.id },
      data: {
        clicks: { increment: 1 },
        lastClickedAt: new Date(),
      },
    });

    // 308 Permanent Redirect preserves the HTTP method for future requests
    return NextResponse.redirect(link.originalUrl, 308);
  } catch (error: any) {
    console.error('[URL Redirect Error]', error);
    return NextResponse.json({ error: 'Redirect failed' }, { status: 500 });
  }
}
