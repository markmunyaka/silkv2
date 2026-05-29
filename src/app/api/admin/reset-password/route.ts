import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/admin/reset-password
// Body: { email, newPassword }
// Resets the admin password (only works if you know the email)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, newPassword } = body;

    if (!email || !newPassword) {
      return NextResponse.json({ ok: false, error: 'Email and new password are required.' }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ ok: false, error: 'Password must be at least 4 characters.' }, { status: 400 });
    }

    // Find the admin user by email
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), role: 'admin' },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'No admin user found with that email.' }, { status: 404 });
    }

    // Update the password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: newPassword },
    });

    return NextResponse.json({
      ok: true,
      data: { message: 'Password reset successfully. You can now log in with your new password.' },
    });
  } catch (error) {
    console.error('[POST /api/admin/reset-password]', error);
    return NextResponse.json({ ok: false, error: 'Failed to reset password.' }, { status: 500 });
  }
}