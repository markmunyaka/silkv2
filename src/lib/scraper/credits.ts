/**
 * Credits utility — checks & deducts credits for scraper operations.
 * Deduction happens only on *successful* email enrichment (1 credit per enriched lead).
 */

import { prisma } from '@/lib/prisma';

export class InsufficientCreditsError extends Error {
  constructor(available: number, required: number) {
    super(`Insufficient credits. You have ${available} but need at least ${required}.`);
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Check if a user has at least `required` credits.
 * Throws InsufficientCreditsError if not enough.
 */
export async function requireCredits(
  userId: string,
  required: number = 1,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  if (user.credits < required) {
    throw new InsufficientCreditsError(user.credits, required);
  }
}

/**
 * Deduct exactly 1 credit from a user's balance.
 * Uses a Prisma raw update with a WHERE guard to prevent negative balance.
 */
export async function deductCredit(userId: string): Promise<number> {
  const result = await prisma.user.updateMany({
    where: {
      id: userId,
      credits: { gte: 1 },
    },
    data: {
      credits: { decrement: 1 },
    },
  });

  if (result.count === 0) {
    // This can happen if the user lost credits between the check and deduction
    throw new InsufficientCreditsError(0, 1);
  }

  // Return remaining credits
  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  return updated!.credits;
}

/**
 * Deduct multiple credits at once (bulk after a batch enrichment).
 */
export async function deductCredits(
  userId: string,
  amount: number,
): Promise<number> {
  const result = await prisma.user.updateMany({
    where: {
      id: userId,
      credits: { gte: amount },
    },
    data: {
      credits: { decrement: amount },
    },
  });

  if (result.count === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    throw new InsufficientCreditsError(user?.credits ?? 0, amount);
  }

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  return updated!.credits;
}