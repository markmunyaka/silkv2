import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { prisma } from '@/lib/prisma';
import type { WarmupInbox } from '@prisma/client';
import type { SendResult } from './types';

/**
 * Nodemailer Transmission Sequence
 *
 * Dynamically authenticates into the sender's SMTP server using credentials
 * from the WarmupInbox record and dispatches the message to the recipient.
 * Logs the outcome in warmup_logs and increments daily_sent_count.
 */

const transporterCache = new Map<string, Transporter>();

function buildTransporter(inbox: WarmupInbox): Transporter {
  const cacheKey = inbox.id;
  if (transporterCache.has(cacheKey)) return transporterCache.get(cacheKey)!;

  const transporter = nodemailer.createTransport({
    host: inbox.smtpHost,
    port: inbox.smtpPort,
    secure: inbox.smtpPort === 465,
    auth: { user: inbox.smtpUser, pass: inbox.smtpPass },
    pool: true,
    maxConnections: 3,
    rateLimit: 5,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  transporterCache.set(cacheKey, transporter);
  return transporter;
}

export function clearTransporterCache(inboxId: string): void {
  transporterCache.delete(inboxId);
}

export function clearAllTransporters(): void {
  transporterCache.clear();
}

/**
 * Send a warmup email from sender to receiver.
 * Logs outcome in warmup_logs and increments daily_sent_count.
 */
export async function sendWarmupEmail(
  sender: WarmupInbox,
  receiverEmail: string,
  subject: string,
  body: string,
  threadId: string,
  inReplyTo?: string,
): Promise<SendResult> {
  try {
    const transporter = buildTransporter(sender);
    const senderName = sender.email.split('@')[0]?.replace(/[._]/g, ' ') ?? 'Sender';

    const headers: Record<string, string> = {
      'X-Warmup': 'true',
      'X-Auto-Response-Suppress': 'All',
      'List-Unsubscribe': `<mailto:unsubscribe@${sender.email.split('@')[1]}>`,
      Precedence: 'bulk',
    };

    if (inReplyTo) {
      headers['In-Reply-To'] = inReplyTo;
      headers.References = inReplyTo;
    }

    const mailOptions = {
      from: `"${senderName}" <${sender.email}>`,
      to: receiverEmail,
      subject,
      text: body,
      html: body
        .split('\n')
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join(''),
      headers,
      messageId: `<${Date.now().toString(36)}.${cryptoRandom()}@${sender.email.split('@')[1]}>`,
    };

    const info = await transporter.sendMail(mailOptions);
    const smtpMessageId: string = info.messageId ?? '';

    await prisma.$transaction([
      prisma.warmupLog.create({
        data: {
          threadId,
          inboxId: sender.id,
          direction: 'sent',
          messageId: smtpMessageId,
          subject,
          bodyPreview: body.slice(0, 200),
          status: 'sent',
          sentAt: new Date(),
        },
      }),
      prisma.warmupInbox.update({
        where: { id: sender.id },
        data: { dailySentCount: { increment: 1 } },
      }),
    ]);

    return { success: true, messageId: smtpMessageId, threadId, inboxId: sender.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SMTP error';

    await prisma.warmupLog.create({
      data: {
        threadId,
        inboxId: sender.id,
        direction: 'sent',
        subject,
        bodyPreview: body.slice(0, 200),
        status: 'failed',
        errorMessage,
        sentAt: new Date(),
      },
    });

    if (
      errorMessage.toLowerCase().includes('auth') ||
      errorMessage.toLowerCase().includes('connect') ||
      errorMessage.toLowerCase().includes('econnrefused')
    ) {
      await prisma.warmupInbox.update({
        where: { id: sender.id },
        data: { status: 'error' },
      });
      clearTransporterCache(sender.id);
    }

    return { success: false, error: errorMessage, threadId, inboxId: sender.id };
  }
}

function cryptoRandom(): string {
  return Math.random().toString(36).substring(2, 10);
}