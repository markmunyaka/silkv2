import { prisma } from '@/lib/prisma';
import type { WarmupInbox } from '@prisma/client';
import type { InboxPair, PairingResult } from './types';

/**
 * Pairing Engine
 *
 * Retrieves all active warmup inboxes, filters out any that have exceeded
 * their daily volume threshold, then randomly pairs senders with receivers.
 * Guarantees: no self-email, each sender once per cycle, respects daily limits.
 */
export async function pairInboxes(
  maxMessagesPerInboxPerCycle: number = 2,
): Promise<PairingResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeInboxes = await prisma.warmupInbox.findMany({
    where: { status: 'active' },
  });

  if (activeInboxes.length < 2) {
    return { pairs: [], skipped: 0 };
  }

  // Reset daily counts if lastResetAt is from a previous day
  const resetInboxes: Promise<any>[] = [];
  for (const inbox of activeInboxes) {
    if (inbox.lastResetAt < today) {
      resetInboxes.push(
        prisma.warmupInbox.update({
          where: { id: inbox.id },
          data: { dailySentCount: 0, lastResetAt: new Date() },
        }),
      );
    }
  }
  if (resetInboxes.length > 0) {
    await Promise.all(resetInboxes);
  }

  const freshInboxes = await prisma.warmupInbox.findMany({
    where: { status: 'active' },
  });

  const eligible = freshInboxes.filter(
    (inbox) => inbox.dailySentCount < inbox.dailyLimit,
  );
  const skipped = freshInboxes.length - eligible.length;

  if (eligible.length < 2) {
    return { pairs: [], skipped };
  }

  // Fisher-Yates shuffle
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const pairs: InboxPair[] = [];
  const usedThisCycle = new Set<string>();

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    const sender = shuffled[i];
    const receiver = shuffled[i + 1];

    if (sender.id === receiver.id) continue;
    if (usedThisCycle.has(sender.id)) continue;

    const updatedSender = await prisma.warmupInbox.findUnique({
      where: { id: sender.id },
    });
    if (!updatedSender || updatedSender.dailySentCount >= updatedSender.dailyLimit) {
      continue;
    }

    usedThisCycle.add(sender.id);
    pairs.push({ sender, receiver });
  }

  return { pairs, skipped };
}

/** Pick a random eligible inbox to serve as a reply target (not the given one). */
export async function pickReplyTarget(
  excludeInboxId: string,
): Promise<WarmupInbox | null> {
  const candidates = await prisma.warmupInbox.findMany({
    where: {
      status: 'active',
      id: { not: excludeInboxId },
    },
  });
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}