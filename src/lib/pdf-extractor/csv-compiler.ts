import { Parser } from 'json2csv';
import { ProcessedDocument, ExtractionField } from './types';

/**
 * Compiles an array of processed documents into a CSV file buffer.
 * Uses json2csv to handle dynamic field mapping.
 * 
 * @param documents Array of processed documents with extracted fields
 * @param fields The original field definitions (used for column ordering and headers)
 * @returns Buffer containing the CSV file data
 */
export function compileToCSV(
  documents: ProcessedDocument[],
  fields: ExtractionField[]
): Buffer {
  if (documents.length === 0) {
    // Return CSV with only headers if no documents
    const headers = ['FileName', 'ExtractedAt', ...fields.map((f) => f.label)];
    const parser = new Parser({ fields: headers.map((h) => ({ label: h, value: h })) });
    const csv = parser.parse([]);
    return Buffer.from(csv, 'utf-8');
  }

  // Build the flattened rows for CSV
  const rows = documents.map((doc) => {
    const row: Record<string, unknown> = {
      FileName: doc.fileName,
      ExtractedAt: doc.extractedAt,
    };
    // Map each field key to its label for the CSV column header
    for (const field of fields) {
      row[field.label] = doc.data[field.key] ?? '';
    }
    return row;
  });

  // Define the JSON-to-CSV field mappings (ordered)
  const csvFields = [
    { label: 'File Name', value: 'FileName' },
    { label: 'Extracted At', value: 'ExtractedAt' },
    ...fields.map((f) => ({
      label: f.label,
      value: f.label,
    })),
  ];

  const parser = new Parser({ fields: csvFields });
  const csv = parser.parse(rows);
  return Buffer.from(csv, 'utf-8');
}

/**
 * Compiles the extraction results directly (without ProcessedDocument wrapper)
 * into a CSV buffer. Useful when you already have the flat results.
 */
export function compileResultsToCSV(
  results: Record<string, string | number | null>[],
  fields: ExtractionField[]
): Buffer {
  const documents: ProcessedDocument[] = results.map((data, index) => ({
    id: `doc-${index + 1}`,
    fileName: `Document ${index + 1}`,
    extractedAt: new Date().toISOString(),
    data,
  }));

  return compileToCSV(documents, fields);
}