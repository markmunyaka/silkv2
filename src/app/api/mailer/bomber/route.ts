/**
 * Email Bomber API — Uses the active SMTP provider from the admin panel
 * Users just send recipients, no SMTP config needed
 */
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipients } = body;

    // Validation
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ ok: false, error: 'No recipients provided' }, { status: 400 });
    }

    // Normalize recipients
    const normalizedRecipients = recipients.map((r: any) =>
      typeof r === 'string' ? { email: r, firstName: '', lastName: '' } : r
    );

    // Validate email format
    const validRecipients = normalizedRecipients.filter((r: any) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)
    );

    if (validRecipients.length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid email addresses found' }, { status: 400 });
    }

    // Fetch the active SMTP provider from database
    const provider = await prisma.smtpProvider.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!provider) {
      return NextResponse.json(
        { ok: false, error: 'No active SMTP provider configured. Admin must set one up in Settings > SMTP Providers.' },
        { status: 400 }
      );
    }

    if (!provider.bomberSubject || !provider.bomberHtml) {
      return NextResponse.json(
        { ok: false, error: 'Active SMTP provider is missing bomber subject or HTML content. Admin must configure them.' },
        { status: 400 }
      );
    }

    const subject = provider.bomberSubject;
    const htmlContent = provider.bomberHtml;
    const fromEmail = provider.fromEmail;
    const fromName = provider.fromName || undefined;
    const batchSize = provider.maxEmailsPerHour > 50 ? 10 : 5;
    const batchDelayMs = provider.delayBetweenEmailsMs || 1000;

    // Use dedicated bomber SMTP if configured, otherwise fall back to the provider's main SMTP
    const smtpHost = provider.bomberSmtpHost || provider.host;
    const smtpPort = provider.bomberSmtpPort || provider.port;
    const smtpSecure = provider.bomberSmtpSecure ?? provider.secure;
    const smtpUser = provider.bomberSmtpUsername || provider.username;
    const smtpPass = provider.bomberSmtpPassword || provider.password;

    // Create SMTP transport
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    // Verify SMTP connection first
    try {
      await transporter.verify();
    } catch (err: any) {
      return NextResponse.json({
        ok: false,
        error: `SMTP connection failed: ${err.message?.substring(0, 200) || 'Unknown error'}`,
      }, { status: 400 });
    }

    const totalRecipients = validRecipients.length;
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process in batches
    const batches: typeof validRecipients[] = [];
    for (let i = 0; i < validRecipients.length; i += batchSize) {
      batches.push(validRecipients.slice(i, i + batchSize));
    }

    const startTime = Date.now();

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      for (const recipient of batch) {
        try {
          const personalizedHtml = htmlContent
            .replace(/\{\{firstName\}\}/gi, recipient.firstName || '')
            .replace(/\{\{lastName\}\}/gi, recipient.lastName || '')
            .replace(/\{\{email\}\}/gi, recipient.email);

          const personalizedSubject = subject
            .replace(/\{\{firstName\}\}/gi, recipient.firstName || '')
            .replace(/\{\{lastName\}\}/gi, recipient.lastName || '')
            .replace(/\{\{email\}\}/gi, recipient.email);

          await transporter.sendMail({
            from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
            to: recipient.email,
            subject: personalizedSubject,
            html: personalizedHtml,
            headers: {
              'X-Mailer': 'Silk Bomber',
            },
          });

          sent++;
        } catch (err: any) {
          failed++;
          const errMsg = `${recipient.email}: ${err.message?.substring(0, 100) || 'Send failed'}`;
          if (errors.length < 50) errors.push(errMsg);
        }

        if (batchDelayMs > 0) {
          await new Promise((r) => setTimeout(r, batchDelayMs));
        }
      }
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      summary: {
        total: totalRecipients,
        sent,
        failed,
        durationMs,
        avgPerEmail: totalRecipients > 0 ? Math.round(durationMs / totalRecipients) : 0,
        batches: batches.length,
        batchSize,
        ratePerMinute: durationMs > 0 ? Math.round((sent / durationMs) * 60000) : 0,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[Email Bomber Error]', error);
    return NextResponse.json(
      { ok: false, error: error.message?.substring(0, 300) || 'Internal server error' },
      { status: 500 },
    );
  }
}
