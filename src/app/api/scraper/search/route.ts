import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import {
  searchBusinesses,
  enrichBusinessEmail,
  requireCredits,
  deductCredit,
} from '@/lib/scraper';

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
    const { query, location, maxResults } = body as {
      query?: string;
      location?: string;
      maxResults?: number;
    };

    if (!query || !location) {
      return NextResponse.json(
        { error: 'Missing required fields: query and location' },
        { status: 400 },
      );
    }

    const limit = Math.min(Math.max(maxResults ?? 20, 1), 50);

    // 3. Search for businesses
    const { results, source } = await searchBusinesses(query, location, limit);

    // 4. For each result, attempt enrichment and insert into DB
    const insertedLeads: Array<{
      id: string;
      companyName: string;
      website: string | null;
      email: string | null;
      status: string;
    }> = [];

    let totalEnriched = 0;

    for (const biz of results) {
      // Insert the lead with status "discovered" first
      const lead = await prisma.scrapedLead.create({
        data: {
          userId: user.id,
          companyName: biz.name,
          industry: biz.types?.length ? biz.types[0] : null,
          location: biz.address,
          website: biz.website,
          phone: biz.phone,
          status: 'discovered',
          source,
        },
      });

      // Attempt enrichment if we have a website
      let email: string | null = null;
      let leadStatus = 'discovered';

      if (biz.website) {
        // Check credits before enriching
        try {
          await requireCredits(user.id, 1);
        } catch (creditErr) {
          // No credits left — skip enrichment for this and all remaining leads
          insertedLeads.push({
            id: lead.id,
            companyName: biz.name,
            website: biz.website,
            email: null,
            status: 'discovered',
          });
          continue;
        }

        // Enrich
        const enrichment = await enrichBusinessEmail(biz.website);

        if (enrichment.email) {
          email = enrichment.email;
          leadStatus = 'enriched';

          // Deduct credit only on successful enrichment
          try {
            await deductCredit(user.id);
            totalEnriched++;
          } catch {
            // Deduction failed (shouldn't happen since we checked above)
            leadStatus = 'discovered';
            email = null;
          }
        } else {
          leadStatus = 'failed';
        }
      }

      // Update the lead with enrichment results
      const updated = await prisma.scrapedLead.update({
        where: { id: lead.id },
        data: {
          email,
          status: leadStatus,
        },
        select: {
          id: true,
          companyName: true,
          website: true,
          email: true,
          status: true,
        },
      });

      insertedLeads.push(updated);
    }

    // 5. Return results
    return NextResponse.json({
      total: insertedLeads.length,
      enriched: totalEnriched,
      leads: insertedLeads,
      source,
    });
  } catch (error: unknown) {
    console.error('[Scraper Search] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}