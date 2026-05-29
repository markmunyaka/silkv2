/**
 * Send Campaign Endpoint - Stateless Bulk Email Sending
 * High-performance in-memory processing with real-time progress
 * Privacy-first: NO recipient data or HTML bodies logged or persisted
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { NodemailerProvider } from '@/lib/email-service/nodemailer-provider';
import { executeStatelessCampaign, validateCampaignConfig, CampaignConfig } from '@/lib/email-service/stateless-engine';
import { filterBusinessOnly, BusinessLead } from '@/lib/email-service/business-filter';

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

    // Check credits (need at least 1 for campaign send)
    if (user.credits < 1) {
      return NextResponse.json(
        { error: 'Insufficient credits', required: 1, available: user.credits },
        { status: 402 }
      );
    }

    const {
      campaignId,
      recipients, // Array of { email, firstName?, lastName?, company?, customData? }
      subject,
      htmlContent,
      textContent,
      fromEmail,
      fromName,
      replyTo,
      batchSize = 10,
      batchDelay = 2000,
    } = body;

    // Build campaign config
    const campaignConfig: CampaignConfig = {
      subject,
      htmlContent,
      textContent,
      fromEmail,
      fromName,
      replyTo,
    };

    // Validate campaign config
    const validation = validateCampaignConfig(campaignConfig);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid campaign configuration', details: validation.errors },
        { status: 400 }
      );
    }

    // Validate we have recipients
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'No recipients provided' },
        { status: 400 }
      );
    }

    // Filter leads to business-only
    const leads = recipients.map((r: any) => ({
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      company: r.company,
      customData: r.customData,
    })) as BusinessLead[];

    const filterResult = filterBusinessOnly(leads);

    if (filterResult.business.length === 0) {
      return NextResponse.json(
        {
          error: 'No business emails found in recipient list',
          stats: filterResult.stats,
        },
        { status: 400 }
      );
    }

    // Create email service with SMTP config from env
    const emailService = new NodemailerProvider({
      provider: 'nodemailer',
      from: fromEmail,
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
    });

    // Create abort controller for cancellation support
    const abortController = new AbortController();

    // Progress tracking (in-memory only, never persisted)
    let progressData: any = null;

    // Execute stateless campaign
    const result = await executeStatelessCampaign({
      sendFn: async (to, html, subject, from, headers) => {
        return await emailService.send({
          to,
          subject,
          html,
          from,
          headers,
        });
      },
      config: campaignConfig,
      leads: filterResult.business,
      batchSize,
      batchDelay,
      abortController,
      onProgress: (progress) => {
        progressData = progress;
      },
    });

    // Return anonymized result (no recipient emails, no HTML content)
    return NextResponse.json({
      success: true,
      summary: {
        totalRecipients: filterResult.stats.total,
        filtered: filterResult.stats.filteredCount,
        sent: result.sent,
        failed: result.failed,
        durationMs: result.duration,
      },
      // Only include anonymized error counts, never the actual errors or emails
      failedCount: result.failed,
      progress: progressData,
      metadata: {
        timestamp: new Date().toISOString(),
        provider: 'nodemailer',
        batchSize,
        totalBatches: Math.ceil(filterResult.business.length / batchSize),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for campaign status (if needed)
 * Returns only anonymized stats, never actual recipient data
 */
export async function GET() {
  return NextResponse.json({
    message: 'Campaign sending is stateless - use POST to send',
    note: 'No campaign data is stored between requests',
  });
}