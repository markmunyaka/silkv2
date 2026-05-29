import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body as { userId: string };

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'User ID is required.' },
        { status: 400 },
      );
    }

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found.' },
        { status: 404 },
      );
    }

    // Delete the user — cascade will remove related records
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      ok: true,
      message: 'Account deleted successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[DELETE /api/auth/delete]', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}