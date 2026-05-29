import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// POST /api/admin/check-access  —  Check if a user can access files
// Used by the dashboard to block suspended/frozen users
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { userId } = body as { userId: string };

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'userId is required.' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found.' },
        { status: 404 },
      );
    }

    const isBlocked = user.status === 'suspended';
    const isFrozen = user.status === 'frozen';

    return NextResponse.json({
      ok: true,
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        credits: user.credits,
        isBlocked,
        isFrozen,
        canAccessFiles: !isBlocked && !isFrozen && user.credits > 0,
        reason: user.violationReason || null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}