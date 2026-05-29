import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// GET /api/credits/[userId]  —  Get user credits from the database
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true, isSubscribed: true, subscriptionPlan: true },
    });

    // If user isn't in the database (localStorage-only user), return default 2 credits
    if (!user) {
      return NextResponse.json({
        userId,
        credits: 2,
        isSubscribed: false,
        subscriptionPlan: null,
      });
    }

    return NextResponse.json({
      userId: user.id,
      credits: user.credits,
      isSubscribed: user.isSubscribed,
      subscriptionPlan: user.subscriptionPlan,
    });
  } catch (error) {
    console.error('[GET /api/credits]', error);
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/credits/[userId]  —  Deduct or add credits (in the database)
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { action, amount } = await request.json();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentCredits = user.credits;

    if (action === 'deduct') {
      if (currentCredits < (amount || 1)) {
        return NextResponse.json(
          { error: 'Insufficient credits' },
          { status: 402 } // Payment Required
        );
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { credits: { decrement: amount || 1 } },
      });

      return NextResponse.json({
        success: true,
        credits: updated.credits,
        message: 'Credit deducted successfully',
      });
    }

    if (action === 'add') {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: amount || 1 } },
      });

      return NextResponse.json({
        success: true,
        credits: updated.credits,
        message: 'Credits added successfully',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[POST /api/credits]', error);
    return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 });
  }
}