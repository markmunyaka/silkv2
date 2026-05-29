import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// GET /api/mailer/campaigns?userId=xxx - Get all campaigns for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'userId is required' }, { status: 400 });
    }

    const campaigns = await prisma.emailCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { name: true, subject: true } },
        recipientList: { select: { name: true } },
        _count: { select: { emailLogs: true } },
      },
    });

    const data = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      status: c.status,
      senderEmail: c.senderEmail,
      senderName: c.senderName,
      emailProvider: c.emailProvider,
      totalRecipients: c.totalRecipients,
      sentCount: c.sentCount,
      failedCount: c.failedCount,
      sentAt: c.sentAt?.toISOString() || null,
      createdAt: c.createdAt.toISOString(),
      templateName: c.template.name,
      templateSubject: c.template.subject,
      recipientListName: c.recipientList.name,
      recipientListId: c.recipientListId,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

// POST /api/mailer/campaigns - Create a new campaign (stored in DB)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId, name, description, templateId, recipientListId,
      senderEmail, senderName, emailProvider, totalRecipients,
    } = body;

    if (!userId || !name || !templateId || !recipientListId || !senderEmail) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: userId, name, templateId, recipientListId, senderEmail' },
        { status: 400 }
      );
    }

    const campaign = await prisma.emailCampaign.create({
      data: {
        userId,
        name,
        description: description || null,
        templateId,
        recipientListId,
        senderEmail,
        senderName: senderName || null,
        emailProvider: emailProvider || 'nodemailer',
        totalRecipients: totalRecipients || 0,
        status: 'draft',
      },
      include: {
        template: { select: { name: true, subject: true } },
        recipientList: { select: { name: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        status: campaign.status,
        senderEmail: campaign.senderEmail,
        senderName: campaign.senderName,
        emailProvider: campaign.emailProvider,
        totalRecipients: campaign.totalRecipients,
        sentCount: 0,
        failedCount: 0,
        createdAt: campaign.createdAt.toISOString(),
        templateName: campaign.template.name,
        templateSubject: campaign.template.subject,
        recipientListName: campaign.recipientList.name,
        recipientListId: campaign.recipientListId,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create campaign' },
      { status: 500 }
    );
  }
}

// PATCH /api/mailer/campaigns - Send a campaign via SMTP (no credit check — crypto-based)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { campaignId, userId } = body;

    if (!campaignId || !userId) {
      return NextResponse.json({ ok: false, error: 'campaignId and userId required' }, { status: 400 });
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        recipientList: { include: { recipients: true } },
      },
    });

    if (!campaign || campaign.userId !== userId) {
      return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });
    }

    // Get the SMTP provider configuration
    const provider = await prisma.smtpProvider.findFirst({
      where: { isActive: true, provider: campaign.emailProvider },
    });

    if (!provider) {
      return NextResponse.json(
        { ok: false, error: 'No active SMTP provider found for this campaign' },
        { status: 400 }
      );
    }

    // Mark campaign as sending
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'in_progress' },
    });

    // Set up transporter
    const transporter = nodemailer.createTransport({
      host: provider.host,
      port: provider.port,
      secure: provider.secure,
      auth: { user: provider.username, pass: provider.password },
    });

    let sentCount = 0;
    let failedCount = 0;

    // Send emails
    for (const recipient of campaign.recipientList.recipients) {
      try {
        // Apply mail merge for {{placeholders}}
        let htmlContent = campaign.template.htmlContent;
        let subject = campaign.template.subject;

        const replacements: Record<string, string> = {
          '{{email}}': recipient.email,
          '{{firstName}}': recipient.firstName || '',
          '{{lastName}}': recipient.lastName || '',
          '{{fullName}}': [recipient.firstName, recipient.lastName].filter(Boolean).join(' '),
        };

        if (recipient.customData) {
          try {
            const custom = JSON.parse(recipient.customData);
            Object.entries(custom).forEach(([key, val]) => {
              replacements[`{{${key}}}`] = String(val || '');
            });
          } catch {}
        }

        for (const [placeholder, value] of Object.entries(replacements)) {
          htmlContent = htmlContent.replaceAll(placeholder, value);
          subject = subject.replaceAll(placeholder, value);
        }

        await transporter.sendMail({
          from: `"${provider.fromName || campaign.senderName || 'Silk Mail'}" <${campaign.senderEmail}>`,
          to: recipient.email,
          subject,
          html: htmlContent,
        });

        sentCount++;

        await prisma.emailLog.create({
          data: {
            campaignId,
            recipientEmail: recipient.email,
            status: 'sent',
            sentAt: new Date(),
          },
        });

        // Small delay to respect rate limits
        await new Promise((r) => setTimeout(r, provider.delayBetweenEmailsMs || 200));
      } catch (err: any) {
        failedCount++;

        await prisma.emailLog.create({
          data: {
            campaignId,
            recipientEmail: recipient.email,
            status: 'failed',
            errorMessage: err.message?.substring(0, 200) || 'Send failed',
          },
        });
      }
    }

    // Update campaign
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'completed',
        sentCount,
        failedCount,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      data: { campaignId, sentCount, failedCount },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to send campaign' },
      { status: 500 }
    );
  }
}

// DELETE /api/mailer/campaigns?id=xxx&userId=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) {
      return NextResponse.json({ ok: false, error: 'id and userId required' }, { status: 400 });
    }

    const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign || campaign.userId !== userId) {
      return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });
    }

    await prisma.emailCampaign.delete({ where: { id } });

    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to delete campaign' },
      { status: 500 }
    );
  }
}