import { Anthropic } from '@anthropic-ai/sdk';
import { ExtractionField, ExtractionResult, ExtractionRequest } from './types';
import { extractText } from '@/utils/pdfParser';

/**
 * Extracts structured data from a PDF buffer based on user-defined fields.
 * Uses Anthropic Claude's tool-calling feature for guaranteed structured output.
 */
export async function extractFieldsFromPDF(
  pdfBuffer: Buffer,
  fields: ExtractionField[]
): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const text = await extractText(pdfBuffer);
  const truncatedText = text.length > 80000 ? text.slice(0, 80000) + '...' : text;

  return extractFieldsFromText(truncatedText, fields);
}

/**
 * Extracts structured data from text using Claude's tool-calling.
 * This guarantees a cleanly structured JSON output matching the user's schema.
 */
export async function extractFieldsFromText(
  text: string,
  fields: ExtractionField[]
): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });

  // Build the JSON schema properties for each requested field
  const properties: Record<string, { type: string; description: string }> = {};
  const requiredFields: string[] = [];

  for (const field of fields) {
    const jsonType = field.type === 'number' || field.type === 'currency' ? 'number' : 'string';
    properties[field.key] = {
      type: jsonType,
      description: field.description || `${field.label} (${field.type})`,
    };
    requiredFields.push(field.key);
  }

  const fieldDescriptions = fields
    .map((f) => `  - "${f.key}": ${f.label} (${f.type})`)
    .join('\n');

  const toolName = 'extract_document_fields';

  const response = await client.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 4096,
    temperature: 0,
    system: `You are a precise document data extraction engine. 
Extract the requested fields from the document text below.
If a field value cannot be found in the document, return null for that field.
Be accurate and do not hallucinate values.`,
    messages: [
      {
        role: 'user',
        content: `Extract the following fields from this document:\n${fieldDescriptions}\n\nDocument:\n${text}`,
      },
    ],
    tools: [
      {
        name: toolName,
        description: 'Extract the requested structured fields from the document',
        input_schema: {
          type: 'object',
          properties,
          required: requiredFields,
        },
      },
    ],
    tool_choice: { type: 'tool', name: toolName },
  });

  // Extract the tool call output
  for (const block of response.content) {
    if (block.type === 'tool_use' && 'name' in block && block.name === toolName && 'input' in block) {
      return block.input as unknown as ExtractionResult;
    }
  }

  // Fallback: if no tool use block, try to parse text response as JSON
  for (const block of response.content) {
    if (block.type === 'text' && 'text' in block) {
      try {
        const parsed = JSON.parse(block.text);
        const result: ExtractionResult = {};
        for (const field of fields) {
          result[field.key] = parsed[field.key] ?? null;
        }
        return result;
      } catch {
        throw new Error('Failed to extract structured data: LLM did not return valid JSON');
      }
    }
  }

  throw new Error('Failed to extract structured data: no output from LLM');
}