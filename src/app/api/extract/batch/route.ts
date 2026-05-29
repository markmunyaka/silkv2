import { NextResponse } from 'next/server';
import { extractFieldsFromPDF } from '@/lib/pdf-extractor/extractor';
import { compileToCSV } from '@/lib/pdf-extractor/csv-compiler';
import { uploadCSVAndGetURL } from '@/lib/pdf-extractor/storage';
import type { ExtractionField, ProcessedDocument } from '@/lib/pdf-extractor/types';

/**
 * POST /api/extract/batch
 * 
 * Batch extract: Upload multiple PDFs with the same field definitions.
 * All results get compiled into a single CSV file.
 * 
 * Body: multipart/form-data
 *   - pdfs: File[] (multiple PDF files)
 *   - fields: JSON string of ExtractionField[]
 *   - userId: string (optional)
 *   - exportCSV: "true" (defaults to true for batch)
 * 
 * Returns:
 *   {
 *     documents: { fileName: string, data: ExtractionResult }[],
 *     totalProcessed: number,
 *     csvDownloadUrl?: string
 *   }
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const pdfFiles: File[] = [];
    const fieldsRaw = formData.get('fields') as string;
    const userId = formData.get('userId') as string | null;

    // Collect all PDF files
    for (const [key, value] of formData.entries()) {
      if (key === 'pdfs' && value instanceof File) {
        pdfFiles.push(value);
      }
      // Also accept 'pdf' keys as individual files
      if (key === 'pdf' && value instanceof File) {
        pdfFiles.push(value);
      }
    }

    if (pdfFiles.length === 0) {
      return NextResponse.json(
        { error: 'No PDF files provided. Send files with key "pdfs" or "pdf".' },
        { status: 400 }
      );
    }

    if (!fieldsRaw) {
      return NextResponse.json(
        { error: 'No fields specified. Provide a JSON string of extraction fields.' },
        { status: 400 }
      );
    }

    // Parse and validate fields
    let fields: ExtractionField[];
    try {
      fields = JSON.parse(fieldsRaw);
      if (!Array.isArray(fields) || fields.length === 0) {
        throw new Error('Fields must be a non-empty array');
      }
      for (const f of fields) {
        if (!f.key || !f.label || !f.type) {
          throw new Error(`Each field must have 'key', 'label', and 'type' properties`);
        }
        if (!['string', 'number', 'date', 'currency'].includes(f.type)) {
          throw new Error(`Invalid field type '${f.type}'`);
        }
      }
    } catch (parseErr: any) {
      return NextResponse.json(
        { error: `Invalid fields JSON: ${parseErr.message}` },
        { status: 400 }
      );
    }

    // Check user credits if userId provided
    if (userId) {
      const creditsResponse = await fetch(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/credits/${userId}`
      );
      const creditsData = await creditsResponse.json();

      // Batch requires 1 credit per file
      if (creditsData.credits < pdfFiles.length) {
        return NextResponse.json(
          { error: `Insufficient credits. Need ${pdfFiles.length} credits, you have ${creditsData.credits}.` },
          { status: 402 }
        );
      }
    }

    // Validate each file
    for (const file of pdfFiles) {
      if (file.type !== 'application/pdf') {
        return NextResponse.json(
          { error: `File "${file.name}" must be a PDF` },
          { status: 400 }
        );
      }
      if (file.size > 100 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 100 MB limit` },
          { status: 400 }
        );
      }
    }

    // Process all PDFs sequentially (to avoid rate limits)
    const documents: ProcessedDocument[] = [];
    const errors: { fileName: string; error: string }[] = [];

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const result = await extractFieldsFromPDF(buffer, fields);

        documents.push({
          id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          fileName: file.name || `document-${i + 1}.pdf`,
          extractedAt: new Date().toISOString(),
          data: result,
        });
      } catch (docErr: any) {
        errors.push({
          fileName: file.name || `document-${i + 1}.pdf`,
          error: docErr.message,
        });
      }
    }

    // Compile and upload CSV
    const csvBuffer = compileToCSV(documents, fields);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const csvFileName = `batch-extract-${timestamp}.csv`;

    const { url } = await uploadCSVAndGetURL(
      csvBuffer,
      csvFileName,
      userId || undefined
    );

    // Deduct credits
    if (userId) {
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/credits/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', amount: documents.length }),
      });
    }

    return NextResponse.json({
      documents: documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        data: d.data,
      })),
      totalProcessed: documents.length,
      totalErrors: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      csvDownloadUrl: url,
    });
  } catch (err: any) {
    console.error('Batch extract API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}