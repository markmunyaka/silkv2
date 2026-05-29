import { prisma } from '@/lib/prisma';
import type { WarmupInbox } from '@prisma/client';
import type { WorkerConfig, ThreadMessage, SendResult, InboxPair } from './types';
import { DEFAULT_WORKER_CONFIG } from './types';
import { pairInboxes } from './pairing-engine';
import { generateMessage } from './llm-generator';
import { sendWarmupEmail, clearAllTransporters } from './sender';

/**
 * Background Worker Orchestrator (Mailer-Integrated)
 *
 * Runs a warmup cycle on a configurable interval:
 *  1. Clean stale threads
 *  2. Complete oversized threads
 *  3. Pair active inboxes
 *  4. Generate & send natural B2B conversations between paired inboxes
 */
export class WarmupWorker {
  private config: WorkerConfig;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = { ...DEFAULT_WORKER_CONFIG, ...config };
  }

  /** Start the worker on an interval. */
  start(): void {
    if (this.intervalHandle) return;
    console.log(`[MailerWarmup] Starting with interval ${this.config.cycleIntervalMs}ms`);

    this.executeCycle().catch((err) =>
      console.error('[MailerWarmup] Initial cycle failed:', err),
    );
    this.intervalHandle = setInterval(() => {
      this.executeCycle().catch((err) =>
        console.error('[MailerWarmup] Cycle failed:', err),
      );
    }, this.config.cycleIntervalMs);
  }

  /** Stop the worker. */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    clearAllTransporters();
    console.log('[MailerWarmup] Stopped');
  }

  /** Execute a single warmup cycle. */
  async executeCycle(): Promise<{
    newMessagesSent: number;
    repliesSent: number;
    threadsCompleted: number;
    staleCleaned: number;
    errors: number;
  }> {
    if (this.running) {
      console.log('[MailerWarmup] Cycle already running, skipping');
      return { newMessagesSent: 0, repliesSent: 0, threadsCompleted: 0, staleCleaned: 0, errors: 0 };
    }

    this.running = true;
    const stats = { newMessagesSent: 0, repliesSent: 0, threadsCompleted: 0, staleCleaned: 0, errors: 0 };

    try {
      console.log('[MailerWarmup] Starting cycle');

      stats.staleCleaned = await this.cleanupStaleThreads();
      stats.threadsCompleted = await this.completeOversizedThreads();

      const { pairs, skipped } = await pairInboxes(this.config.maxMessagesPerInboxPerCycle);
      if (skipped > 0) console.log(`[MailerWarmup] ${skipped} inboxes skipped (daily limit)`);

      if (pairs.length === 0) return stats;

      for (const pair of pairs) {
        try {
          const result = await this.processPair(pair);
          stats.newMessagesSent += result.newSent;
          stats.repliesSent += result.repliesSent;
          stats.errors += result.errors;
        } catch (err) {
          stats.errors++;
          console.error(`[MailerWarmup] Error processing pair:`, err);
        }
      }

      console.log(
        `[MailerWarmup] Cycle done: ${stats.newMessagesSent} new, ${stats.repliesSent} replies, ` +
        `${stats.threadsCompleted} completed, ${stats.staleCleaned} stale, ${stats.errors} errors`,
      );
    } catch (err) {
      console.error('[MailerWarmup] Cycle error:', err);
      stats.errors++;
    } finally {
      this.running = false;
    }

    return stats;
  }

  private async processPair(pair: InboxPair): Promise<{ newSent: number; repliesSent: number; errors: number }> {
    const result = { newSent: 0, repliesSent: 0, errors: 0 };
    const { sender, receiver } = pair;

    const thread = await prisma.warmupThread.findFirst({
      where: { senderId: sender.id, receiverId: receiver.id, status: 'active' },
    });

    if (!thread) {
      result.newSent = await this.createAndSendNewThread(sender, receiver);
    } else {
      const history: ThreadMessage[] = JSON.parse(thread.threadHistory || '[]');
      const lastMsg = history[history.length - 1];
      const isReplyFromReceiver = lastMsg?.role === 'sent';
      const replySender = isReplyFromReceiver ? receiver : sender;
      const replyReceiver = isReplyFromReceiver ? sender : receiver;

      const sendResult = await this.generateAndSendMessage(
        replySender,
        replyReceiver.email,
        thread.subject,
        history,
        thread.id,
        lastMsg?.messageId,
      );

      if (sendResult.success) {
        history.push({
          role: 'sent',
          content: `[Follow-up in thread ${thread.id}]`,
          messageId: sendResult.messageId ?? '',
          timestamp: new Date().toISOString(),
        });
        await prisma.warmupThread.update({
          where: { id: thread.id },
          data: { threadHistory: JSON.stringify(history), messageCount: { increment: 1 }, lastMessageAt: new Date() },
        });
        result.repliesSent++;
      } else {
        result.errors++;
      }
    }

    return result;
  }

  private async createAndSendNewThread(sender: WarmupInbox, receiver: WarmupInbox): Promise<number> {
    const generated = await generateMessage(sender.email, receiver.email, [], this.config.llm);

    const thread = await prisma.warmupThread.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        subject: generated.subject,
        threadHistory: '[]',
        messageCount: 0,
        status: 'active',
      },
    });

    const sendResult = await sendWarmupEmail(sender, receiver.email, generated.subject, generated.body, thread.id);

    if (sendResult.success) {
      const history: ThreadMessage[] = [{
        role: 'sent',
        content: generated.body,
        messageId: sendResult.messageId ?? '',
        timestamp: new Date().toISOString(),
      }];
      await prisma.warmupThread.update({
        where: { id: thread.id },
        data: { threadHistory: JSON.stringify(history), messageCount: 1, lastMessageAt: new Date() },
      });
      return 1;
    }
    return 0;
  }

  private async generateAndSendMessage(
    sender: WarmupInbox,
    receiverEmail: string,
    subject: string,
    history: ThreadMessage[],
    threadId: string,
    inReplyTo?: string,
  ): Promise<SendResult> {
    const generated = await generateMessage(sender.email, receiverEmail, history, this.config.llm);
    return sendWarmupEmail(sender, receiverEmail, generated.subject || `Re: ${subject}`, generated.body, threadId, inReplyTo);
  }

  private async completeOversizedThreads(): Promise<number> {
    const oversized = await prisma.warmupThread.findMany({
      where: { status: 'active', messageCount: { gte: this.config.maxMessagesPerThread } },
    });
    if (oversized.length === 0) return 0;
    await prisma.warmupThread.updateMany({
      where: { id: { in: oversized.map((t) => t.id) } },
      data: { status: 'completed' },
    });
    return oversized.length;
  }

  private async cleanupStaleThreads(): Promise<number> {
    const staleThreshold = new Date(Date.now() - this.config.staleThreadTimeoutMs);
    const stale = await prisma.warmupThread.findMany({
      where: { status: 'active', lastMessageAt: { lt: staleThreshold } },
    });
    if (stale.length === 0) return 0;
    await prisma.warmupThread.updateMany({
      where: { id: { in: stale.map((t) => t.id) } },
      data: { status: 'stale' },
    });
    return stale.length;
  }
}