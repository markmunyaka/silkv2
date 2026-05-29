/**
 * Extract plain text from a PDF file buffer.
 * @param fileBuffer Buffer containing PDF data
 * @returns extracted text as a string
 */
import { convertToText } from './pdfConverter';

export async function extractText(fileBuffer: Buffer): Promise<string> {
  try {
    return await convertToText(fileBuffer);
  } catch (err: any) {
    throw new Error(`PDF parsing failed: ${err.message}`);
  }
}
