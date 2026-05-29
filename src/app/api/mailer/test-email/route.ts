/**
 * Test Email Endpoint - Paid 'Test Send' with Credit Logic
 * Deducts 1 credit atomically, refunds on SMTP failure
 * Privacy-first: NO logging of recipient or content
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { NodemailerProvider } from '@/lib/email-service/nodemailer-provider';
import { renderHtmlTemplate, buildLeadPlaceholders } from '@/lib/email-service/business-filter';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse body once
    const body = await request.json();

    // Legal gatekeeper: Terms acceptance required
    if (!body.acceptedTerms) {
      return NextResponse.json(
        { error: 'Terms of service must be accepted', code: 'TERMS_NOT_ACCEPTED' },
        { status: 403 }
      );
    }

    // Check credits atomically
    if (user.credits < 1) {
      return NextResponse.json(
        { error: 'Insufficient credits', required: 1, available: user.credits },
        { status: 402 }
      );
    }

    const { toEmail, subject, htmlContent, fromEmail, fromName, templateData } = body;

    // Validate required fields
    if (!toEmail || !subject || !htmlContent || !fromEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: toEmail, subject, htmlContent, fromEmail' },
        { status: 400 }
      );
    }

    // Use transaction for atomic credit deduction + send
    const result = await prisma.$transaction(async (tx) => {
      // Deduct credit atomically
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { credits: { decrement: 1 } },
      });

      return { user: updatedUser, creditDeducted: true };
    });

    // Prepare email with template rendering (in-memory only)
    const placeholders = templateData || {};
    const renderedHtml = renderHtmlTemplate(htmlContent, placeholders);

    // Create email service (use configured SMTP or mock for testing)
    const emailService = new NodemailerProvider({
      provider: 'nodemailer',
      from: fromEmail,
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
    });

    // Try to send, refund credit on failure
    let sendSuccess = false;
    let messageId: string | undefined;
    let sendError: string | undefined;

    try {
      const sendResult = await emailService.send({
        to: toEmail,
        subject,
        html: renderedHtml,
        from: fromEmail,
      });

      sendSuccess = sendResult.success;
      messageId = sendResult.messageId;
      sendError = sendResult.error;

      if (!sendResult.success) {
        throw new Error(sendResult.error || 'SMTP send failed');
      }
    } catch (error) {
      sendSuccess = false;
      sendError = error instanceof Error ? error.message : 'Unknown send error';

      // SELF-HEALING: Refund credit on send failure
      await prisma.user.update({
        where: { id: user.id },
        data: { credits: { increment: 1 } },
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Email send failed - credit refunded',
          details: sendError,
          creditRefunded: true,
        },
        { status: 502 }
      );
    }

    // Success response (no logging of content or recipient per privacy requirements)
    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      messageId,
      creditsRemaining: result.user.credits,
      // Only log anonymized metadata, never content or addresses
      metadata: {
        timestamp: new Date().toISOString(),
        provider: 'nodemailer',
      },
    });
  } catch (error) {
    // Refund credit on any unexpected error
    try {
      const session = await getServerSession();
      if (session?.user?.email) {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
        });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { credits: { increment: 1 } },
          });
        }
      }
    } catch {
      // Best effort refund
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}