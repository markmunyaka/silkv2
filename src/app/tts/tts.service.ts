import OpenAI from 'openai';
import { uploadToStorage } from './storage.service';

export async function convertTextToAudio(summaryText: string, userId: string): Promise<string> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: summaryText,
    });

    const audioBlob = new Blob([await response.arrayBuffer()], { type: 'audio/mp3' });
    const audioUrl = await uploadToStorage(audioBlob, userId);
    return audioUrl;
  } catch (error) {
    console.error('TTS conversion failed:', error);
    throw new Error('Failed to generate audio summary');
  }
}