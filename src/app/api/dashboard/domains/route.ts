import { NextResponse } from 'next/server';
import { searchBusinesses } from '@/lib/scraper/search-service';

export async function GET() {
  try {
    // Search for 'pdf summarize' globally, limited to 10 results
    const { results } = await searchBusinesses('pdf summarize', 'global', 10);
    // Extract the domain part from each website URL (strip protocol)
    const domains = results
      .map((r) => (r.website ? r.website.replace(/^https?:\/\//, '') : ''))
      .filter(Boolean);
    return new NextResponse(JSON.stringify(domains), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch domains:', error);
    return new NextResponse('[]', {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}