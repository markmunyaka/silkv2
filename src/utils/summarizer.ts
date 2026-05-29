import { Anthropic } from '@anthropic-ai/sdk';
import pdfParse from 'pdf-parse';

/**
 * Generate a concise summary for the given text using Claude API.
 * @param text Full extracted PDF text.
 * @returns Summary string.
 */
export async function summarize(text: string, includeCitations = false, pageCount?: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });

  const prompt = includeCitations ? `You are a helpful assistant. Summarize the following document in 3‑5 concise sentences, preserving the main points and important details. For each summary point, include a citation in the format [page X, paragraph Y] indicating where in the PDF the information appears. Use the original PDF page numbers and count paragraphs within each page (separated by blank lines).\n\nDocument:\n${text}` : `You are a helpful assistant. Summarize the following document in 3‑5 concise sentences, preserving the main points and important details.\n\nDocument:\n${text}`;

  const response = await client.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 1024,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  // The response content is an array of blocks; we expect a single text block.
  const summary = typeof response.content[0] === 'object' && 'text' in response.content[0]
    ? (response.content[0] as { text: string }).text.trim()
    : '';

  return summary;
}
