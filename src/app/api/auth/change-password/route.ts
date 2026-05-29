import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

// Helper to verify current password and update to new password
async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  // Get user from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.password) {
    throw new Error('User not found or password not set');
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password with bcrypt
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update password in database
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { success: true };
}

export async function POST(request: NextRequest) {
  try {
    // Get auth token from session/cookie or header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { message: 'Unauthorized - token required' },
        { status: 401 }
      );
    }

    // Find session by token
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
    });

    if (!session || session.expires < new Date()) {
      return NextResponse.json(
        { message: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: 'Current and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Change password
    await changePassword(session.userId, currentPassword, newPassword);

    // Invalidate all other sessions for security
    await prisma.session.deleteMany({
      where: { userId: session.userId, id: { not: session.id } },
    });

    return NextResponse.json(
      { message: 'Password changed successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to change password' },
      { status: 400 }
    );
  }
}