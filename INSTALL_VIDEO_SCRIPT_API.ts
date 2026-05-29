// VIDEO SCRIPT API ROUTE
// Place this file at: src/app/api/generate-video-script/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateVideoScript } from '@/utils/videoScriptGenerator';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { summary, text } = body;

    const summaryText = summary || text;

    if (!summaryText || typeof summaryText !== 'string' || summaryText.trim().length === 0) {
      return NextResponse.json({ error: 'Summary text is required' }, { status: 400 });
    }

    if (summaryText.length > 5000) {
      return NextResponse.json({ error: 'Summary text exceeds maximum length of 5000 characters' }, { status: 400 });
    }

    const videoScript = await generateVideoScript(summaryText);

    return NextResponse.json(videoScript, { status: 200 });
  } catch (error: any) {
    console.error('Video script generation error:', error);

    if (error.message.includes('Invalid PDF buffer') || error.message.includes('requires the key')) {
      return NextResponse.json({ error: 'Invalid request or missing API credentials' }, { status: 400 });
    }

    return NextResponse.json({ error: error.message || 'Failed to generate video script' }, { status: 500 });
  }
}
