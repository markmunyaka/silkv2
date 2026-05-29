import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/scraper/push-to-mailer
 *
 * Batches selected scraped_leads rows and copies them into the main contacts
 * (EmailRecipient) table so the Email Mailer can access them instantly.
 *
 * Request body:
 *   leadIds: string[]  — The scraped lead IDs to push
 *   recipientListId?: string — Optional existing list ID to append to
 *   recipientListName?: string — If no recipientListId, creates a new list with this name
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
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

    // 2. Parse body
    const body = await request.json();
    const { leadIds, recipientListId, recipientListName } = body as {
      leadIds?: string[];
      recipientListId?: string;
      recipientListName?: string;
    };

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: leadIds must be a non-empty array' },
        { status: 400 },
      );
    }

    // 3. Fetch the selected leads that belong to this user
    const leads = await prisma.scrapedLead.findMany({
      where: {
        id: { in: leadIds },
        userId: user.id,
      },
    });

    if (leads.length === 0) {
      return NextResponse.json(
        { error: 'No matching leads found for this user' },
        { status: 404 },
      );
    }

    // 4. Determine the target recipient list
    let targetListId: string;

    if (recipientListId) {
      // Verify the list exists and belongs to the user
      const existingList = await prisma.emailRecipientList.findFirst({
        where: { id: recipientListId, userId: user.id },
      });

      if (!existingList) {
        return NextResponse.json(
          { error: 'Recipient list not found or does not belong to this user' },
          { status: 404 },
        );
      }

      targetListId = recipientListId;
    } else {
      // Create a new recipient list
      const listName =
        recipientListName ??
        `Scraped Leads — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      const newList = await prisma.emailRecipientList.create({
        data: {
          userId: user.id,
          name: listName,
          description: `Auto-imported from B2B Lead Scraper (${leads.length} leads)`,
          totalCount: 0,
        },
      });

      targetListId = newList.id;
    }

    // 5. Insert leads as EmailRecipients
    //    We skip leads without an email since they're not useful for mailers.
    let insertedCount = 0;
    const skipped: Array<{ companyName: string; reason: string }> = [];

    for (const lead of leads) {
      if (!lead.email) {
        skipped.push({ companyName: lead.companyName, reason: 'No email found' });
        continue;
      }

      try {
        await prisma.emailRecipient.create({
          data: {
            recipientListId: targetListId,
            email: lead.email,
            firstName: lead.companyName, // use company name as firstName for context
            lastName: null,
            customData: JSON.stringify({
              companyName: lead.companyName,
              industry: lead.industry,
              location: lead.location,
              website: lead.website,
              phone: lead.phone,
              leadId: lead.id,
            }),
          },
        });
        insertedCount++;
      } catch (err: unknown) {
        // Likely a unique constraint violation (duplicate email in list) — skip
        const msg = err instanceof Error ? err.message : 'Unknown error';
        skipped.push({ companyName: lead.companyName, reason: msg });
      }
    }

    // 6. Update the recipient list total count
    await prisma.emailRecipientList.update({
      where: { id: targetListId },
      data: {
        totalCount: { increment: insertedCount },
      },
    });

    // 7. Mark pushed leads as "pushed"
    await prisma.scrapedLead.updateMany({
      where: {
        id: { in: leads.filter((l) => l.email).map((l) => l.id) },
      },
      data: {
        status: 'pushed',
      },
    });

    // 8. Return result
    return NextResponse.json({
      success: true,
      recipientListId: targetListId,
      totalSelected: leads.length,
      inserted: insertedCount,
      skipped,
    });
  } catch (error: unknown) {
    console.error('[Scraper Push-to-Mailer] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}