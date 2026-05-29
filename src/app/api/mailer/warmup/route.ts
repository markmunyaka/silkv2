/**
 * Warm-up Management API — Silk Mailer
 *
 * POST /api/mailer/warmup          → Execute a single warmup cycle
 * POST /api/mailer/warmup/start     → Start the background worker
 * POST /api/mailer/warmup/stop      → Stop the background worker
 * GET  /api/mailer/warmup/stats     → Get warmup stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { WarmupWorker } from '@/lib/email-service/warmup';

// Singleton worker instance (lifetime of the server)
let worker: WarmupWorker | null = null;

function getWorker(): WarmupWorker {
  if (!worker) {
    worker = new WarmupWorker({
      cycleIntervalMs: parseInt(process.env.WARMUP_CYCLE_INTERVAL_MINUTES || '5') * 60 * 1000,
      maxMessagesPerInboxPerCycle: parseInt(process.env.WARMUP_MAX_MESSAGES_PER_CYCLE || '2'),
      maxMessagesPerThread: parseInt(process.env.WARMUP_MAX_MESSAGES_PER_THREAD || '6'),
      llm: {
        provider: (process.env.WARMUP_LLM_PROVIDER as 'openai' | 'anthropic' | 'google') || 'openai',
        apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
        model: process.env.WARMUP_LLM_MODEL || 'gpt-4o-mini',
      },
    });
  }
  return worker;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user has active warmup inboxes
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { warmupInboxes: { where: { status: 'active' }, take: 1 } },
    });

    if (!user || user.warmupInboxes.length === 0) {
      return NextResponse.json(
        { error: 'No active warmup inboxes found. Add inboxes first.' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || 'cycle';

    switch (action) {
      case 'cycle': {
        const w = getWorker();
        const stats = await w.executeCycle();
        return NextResponse.json({ success: true, stats });
      }

      case 'start': {
        const w = getWorker();
        w.start();
        return NextResponse.json({ success: true, message: 'Warmup worker started' });
      }

      case 'stop': {
        if (worker) {
          worker.stop();
          worker = null;
        }
        return NextResponse.json({ success: true, message: 'Warmup worker stopped' });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[WarmupAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [inboxes, activeThreads, todayLogs] = await Promise.all([
      prisma.warmupInbox.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          email: true,
          status: true,
          dailySentCount: true,
          dailyLimit: true,
          warmupPhase: true,
          createdAt: true,
        },
      }),
      prisma.warmupThread.count({
        where: { status: 'active', sender: { userId: user.id } },
      }),
      prisma.warmupLog.count({
        where: {
          inbox: { userId: user.id },
          status: 'sent',
          sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    return NextResponse.json({
      inboxes: inboxes.length,
      activeThreads,
      todaySent: todayLogs,
      inboxList: inboxes,
    });
  } catch (error) {
    console.error('[WarmupAPI] Stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}