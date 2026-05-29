/**
 * Warmup Inboxes CRUD API — Silk Mailer
 *
 * GET    /api/mailer/warmup/inboxes     → List authenticated user's inboxes
 * POST   /api/mailer/warmup/inboxes     → Register a new SMTP/IMAP inbox
 * PATCH  /api/mailer/warmup/inboxes/:id → Update inbox config
 * DELETE /api/mailer/warmup/inboxes/:id → Remove an inbox
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const inboxes = await prisma.warmupInbox.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        email: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        // Never expose smtpPass
        imapHost: true,
        imapPort: true,
        imapUser: true,
        status: true,
        dailySentCount: true,
        dailyLimit: true,
        warmupPhase: true,
        lastResetAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ inboxes });
  } catch (error) {
    console.error('[WarmupInboxes] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();

    // Validate required fields
    const required = ['email', 'smtpHost', 'smtpUser', 'smtpPass'];
    for (const field of required) {
      if (!body[field]?.trim()) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Check for duplicate inbox email
    const existing = await prisma.warmupInbox.findUnique({
      where: { email: body.email },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'An inbox with this email already exists' },
        { status: 409 },
      );
    }

    const inbox = await prisma.warmupInbox.create({
      data: {
        userId: user.id,
        email: body.email,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort || 587,
        smtpUser: body.smtpUser,
        smtpPass: body.smtpPass,
        imapHost: body.imapHost || body.smtpHost,
        imapPort: body.imapPort || 993,
        imapUser: body.imapUser || body.smtpUser,
        imapPass: body.imapPass || body.smtpPass,
        dailyLimit: body.dailyLimit || 30,
        warmupPhase: body.warmupPhase || 'ramp_up',
      },
      select: {
        id: true,
        email: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        status: true,
        dailySentCount: true,
        dailyLimit: true,
        warmupPhase: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, inbox }, { status: 201 });
  } catch (error) {
    console.error('[WarmupInboxes] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}