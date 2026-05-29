import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

function generateShortCode(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

async function ensureUniqueCode(customCode?: string): Promise<string> {
  if (customCode) {
    const exists = await prisma.shortenedUrl.findUnique({ where: { shortCode: customCode } });
    if (exists) throw new Error('Custom alias already taken');
    return customCode;
  }
  let code: string;
  let exists: unknown;
  do {
    code = generateShortCode();
    exists = await prisma.shortenedUrl.findUnique({ where: { shortCode: code } });
  } while (exists);
  return code;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidCustomCode(code: string): boolean {
  return /^[a-zA-Z0-9_-]{3,16}$/.test(code);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, userId, customCode, title, expiresAt } = body as {
      url?: string;
      userId?: string;
      customCode?: string;
      title?: string;
      expiresAt?: string | null;
    };

    if (!url || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: url and userId' },
        { status: 400 },
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid URL. Must start with http:// or https://' },
        { status: 400 },
      );
    }

    // Validate custom code if provided
    if (customCode && !isValidCustomCode(customCode)) {
      return NextResponse.json(
        { ok: false, error: 'Custom alias must be 3-16 alphanumeric characters (hyphens and underscores allowed)' },
        { status: 400 },
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 },
      );
    }

    let shortCode: string;
    try {
      shortCode = await ensureUniqueCode(customCode || undefined);
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 409 },
      );
    }

    const shortened = await prisma.shortenedUrl.create({
      data: {
        userId,
        originalUrl: url,
        shortCode,
        title: title || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.headers.get('origin') || 'http://localhost:3000';

    return NextResponse.json({
      ok: true,
      data: {
        id: shortened.id,
        shortCode: shortened.shortCode,
        shortUrl: `${baseUrl}/s/${shortened.shortCode}`,
        originalUrl: shortened.originalUrl,
        title: shortened.title,
        clicks: shortened.clicks,
        isActive: shortened.isActive,
        expiresAt: shortened.expiresAt?.toISOString() ?? null,
        createdAt: shortened.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[URL Shorten Error]', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to shorten URL' },
      { status: 500 },
    );
  }
}
