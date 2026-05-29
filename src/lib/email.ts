import crypto from 'crypto';
import { prisma } from './prisma';
import bcrypt from 'bcrypt';

// In production, integrate with SendGrid, AWS SES, or similar
// For now, this is a mock implementation
export async function sendPasswordResetEmail(email: string, resetLink: string) {
  console.log(`Password reset email sent to ${email}: ${resetLink}`);
  // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
}

// Verify password reset token and update password
export async function resetPassword(token: string, newPassword: string) {
  // Hash the provided token to look up in database
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Find the unused, non-expired reset token
  const reset = await prisma.passwordReset.findFirst({
    where: {
      token: tokenHash,
      used: false,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: true,
    },
  });

  if (!reset) {
    throw new Error('Invalid or expired reset token');
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update user password
  await prisma.user.update({
    where: { id: reset.userId },
    data: { password: hashedPassword },
  });

  // Mark token as used
  await prisma.passwordReset.update({
    where: { id: reset.id },
    data: { used: true },
  });

  return { success: true };
}
