import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { message: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Find user (case-insensitive)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // If user exists, generate reset token and send email
    if (user) {
      // Generate a secure random token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

      // Store hashed token in database
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          token: tokenHash,
          expiresAt,
        },
      });

      // Send reset email (in production, use a real email service)
      const resetLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, resetLink);
    }

    // Always return success to avoid email enumeration
    return NextResponse.json(
      { message: 'If an account exists, a password reset email has been sent.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { message: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}