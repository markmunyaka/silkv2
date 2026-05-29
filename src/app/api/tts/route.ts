import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { summary, fileName } = await request.json();

    if (!summary) {
      return NextResponse.json({ error: 'Summary is required' }, { status: 400 });
    }

    // Generate speech from text
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'nova', // Professional voice
      input: summary,
      speed: 0.95, // Slightly slower for clarity
    });

    // Convert to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());

    // Ensure audio directory exists
    const audioDir = join(process.cwd(), 'public', 'audio');
    if (!existsSync(audioDir)) {
      await mkdir(audioDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const audioFileName = `${timestamp}-${fileName.replace('.pdf', '')}.mp3`;
    const audioPath = join(audioDir, audioFileName);

    // Save file
    await writeFile(audioPath, buffer);

    // Return the URL path
    const audioUrl = `/audio/${audioFileName}`;

    return NextResponse.json({
      success: true,
      audioUrl,
      message: 'Audio generated successfully',
    });
  } catch (error) {
    console.error('TTS Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio' },
      { status: 500 }
    );
  }
}
