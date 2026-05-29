/**
 * A single field the user wants to extract from a PDF.
 */
export interface ExtractionField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'currency';
  description?: string;
}

/**
 * The structured result from LLM extraction.
 */
export type ExtractionResult = Record<string, string | number | null>;

/**
 * A processed document with its extracted fields.
 */
export interface ProcessedDocument {
  id: string;
  fileName: string;
  extractedAt: string;
  data: ExtractionResult;
}

/**
 * Request body for a single PDF extraction.
 */
export interface ExtractionRequest {
  fields: ExtractionField[];
  /** Optional userId for credit tracking. */
  userId?: string;
}