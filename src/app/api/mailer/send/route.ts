import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { EmailServiceFactory } from '@/lib/email-service';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { campaignId } = body;

    if (!campaignId) {
      return NextResponse.json({ error: 'Missing required field: campaignId' }, { status: 400 });
    }

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id: campaignId, userId: user.id },
      include: {
        template: true,
        recipientList: {
          include: {
            recipients: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft campaigns can be sent' },
        { status: 400 }
      );
    }

    // Update campaign status to in_progress
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'in_progress', sentAt: new Date() },
    });

    // Send emails
    let sentCount = 0;
    let failedCount = 0;

    try {
      const providerConfig = campaign.providerConfig ? JSON.parse(campaign.providerConfig) : {};
      const emailService = EmailServiceFactory.createService(campaign.emailProvider, {
        provider: campaign.emailProvider,
        from: campaign.senderEmail,
        ...providerConfig,
      });

      for (const recipient of campaign.recipientList.recipients) {
        try {
          const result = await emailService.send({
            to: recipient.email,
            subject: campaign.template.subject,
            html: campaign.template.htmlContent,
            text: campaign.template.textContent,
            from: campaign.senderEmail,
            customData: recipient.customData ? JSON.parse(recipient.customData) : {},
          });

          // Create email log
          await prisma.emailLog.create({
            data: {
              campaignId,
              recipientEmail: recipient.email,
              status: result.success ? 'sent' : 'failed',
              messageId: result.messageId,
              errorMessage: result.error,
              sentAt: result.success ? new Date() : null,
            },
          });

          if (result.success) {
            sentCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          failedCount++;
          console.error(`Error sending email to ${recipient.email}:`, error);

          await prisma.emailLog.create({
            data: {
              campaignId,
              recipientEmail: recipient.email,
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      }

      // Update campaign with final counts
      const status = failedCount === 0 ? 'completed' : failedCount === sentCount ? 'failed' : 'completed';
      const updatedCampaign = await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status,
          sentCount,
          failedCount,
        },
      });

      return NextResponse.json({
        success: true,
        campaign: updatedCampaign,
        summary: {
          total: campaign.totalRecipients,
          sent: sentCount,
          failed: failedCount,
        },
      });
    } catch (error) {
      // Update campaign to failed status
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { status: 'failed' },
      });

      throw error;
    }
  } catch (error) {
    console.error('Error sending campaign:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
