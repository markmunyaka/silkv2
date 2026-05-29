import { NextResponse } from 'next/server';
import { convertPdf, ConversionFormat } from '@/utils/pdfConverter';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf');
    const format = formData.get('format') as ConversionFormat;
    const userId = formData.get('userId') as string;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    if (!format) {
      return NextResponse.json({ error: 'Conversion format required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Validate size (100 MB limit)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File exceeds 100 MB limit' }, { status: 400 });
    }

    // Check user credits before processing
    try {
      const creditsResponse = await fetch(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/credits/${userId}`
      );
      if (!creditsResponse.ok) {
        throw new Error('Failed to fetch user credits');
      }
      const creditsData = await creditsResponse.json();

      if (creditsData.credits < 1) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please upgrade your plan.' },
          { status: 402 }
        );
      }
    } catch (error: any) {
      console.error('Credit check error:', error);
      return NextResponse.json(
        { error: 'Failed to verify credits. Please try again.' },
        { status: 500 }
      );
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convert PDF to requested format
    let result;
    try {
      result = await convertPdf(buffer, format);
    } catch (conversionError: any) {
      console.error('PDF conversion error:', conversionError);
      return NextResponse.json(
        { error: conversionError.message || 'Failed to convert PDF' },
        { status: 400 }
      );
    }

    // Deduct 1 credit from user
    try {
      const deductResponse = await fetch(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/credits/${userId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deduct', amount: 1 }),
        }
      );
      if (!deductResponse.ok) {
        console.warn('Failed to deduct credit, but conversion succeeded');
      }
    } catch (error: any) {
      console.warn('Error deducting credit:', error);
    }

    const fileName = `${file.name.replace(/\.[^/.]+$/, '')}${result.extension}`;

    // Handle binary formats (docx, xlsx, pptx)
    if (Buffer.isBuffer(result.content)) {
      const headers = new Headers();
      headers.set('Content-Type', result.mimeType);
      headers.set('Content-Disposition', `attachment; filename="${fileName}"`);

      return new NextResponse(result.content, {
        status: 200,
        headers,
      });
    }

    // Handle text formats (json, text, csv, html, markdown)
    return NextResponse.json({
      success: true,
      content: result.content,
      fileName,
      mimeType: result.mimeType,
      creditsRemaining: creditsData.credits - 1,
    });
  } catch (err: any) {
    console.error('Convert API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
