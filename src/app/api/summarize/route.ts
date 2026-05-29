import { NextResponse } from 'next/server';
import { extractText } from '@/utils/pdfParser';
import { summarize } from '@/utils/summarizer';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf');
    const userId = formData.get('userId') as string;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Validate size (100 MB limit)
    const maxSize = 100 * 1024 * 1024; // 100 MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File exceeds 100 MB limit' }, { status: 400 });
    }

    // Check user credits before processing
    const creditsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/credits/${userId}`);
    const creditsData = await creditsResponse.json();

    if (creditsData.credits < 1) {
      return NextResponse.json(
        { error: 'Insufficient credits. Please upgrade your plan.' },
        { status: 402 } // Payment Required
      );
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const text = await extractText(buffer);

    // Truncate text to avoid excessive token usage
    const truncatedText = text.length > 50000 ? text.slice(0, 50000) + '...' : text;

    // Generate summary using Claude API
    const summary = await summarize(truncatedText, true);

    // Deduct 1 credit from user
    await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/credits/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deduct', amount: 1 }),
    });

    return NextResponse.json({ 
      summary, 
      textLength: text.length,
      creditsRemaining: creditsData.credits - 1,
    });
  } catch (err: any) {
    console.error('Summarize API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
