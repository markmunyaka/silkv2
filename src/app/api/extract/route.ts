import { NextResponse } from 'next/server';
import { extractFieldsFromPDF } from '@/lib/pdf-extractor/extractor';
import { compileToCSV } from '@/lib/pdf-extractor/csv-compiler';
import { uploadCSVAndGetURL } from '@/lib/pdf-extractor/storage';
import type { ExtractionField, ProcessedDocument } from '@/lib/pdf-extractor/types';

/**
 * POST /api/extract
 * 
 * Single PDF extraction: Upload a PDF and specify what fields to extract.
 * Body: multipart/form-data
 *   - pdf: File (the PDF)
 *   - fields: JSON string of ExtractionField[] 
 *   - userId: string (optional, for credit tracking & storage isolation)
 *   - exportCSV: "true" | "false" (optional, if true returns a Supabase download URL)
 * 
 * Returns:
 *   { 
 *     data: ExtractionResult,
 *     fileName: string,
 *     csvDownloadUrl?: string  // Only if exportCSV=true
 *   }
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf');
    const fieldsRaw = formData.get('fields') as string;
    const userId = formData.get('userId') as string | null;
    const exportCSV = formData.get('exportCSV') === 'true';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    if (!fieldsRaw) {
      return NextResponse.json({ error: 'No fields specified. Provide a JSON string of extraction fields.' }, { status: 400 });
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

    // Parse the fields definition
    let fields: ExtractionField[];
    try {
      fields = JSON.parse(fieldsRaw);
      if (!Array.isArray(fields) || fields.length === 0) {
        throw new Error('Fields must be a non-empty array');
      }
      // Validate each field has required properties
      for (const f of fields) {
        if (!f.key || !f.label || !f.type) {
          throw new Error(`Each field must have 'key', 'label', and 'type' properties`);
        }
        if (!['string', 'number', 'date', 'currency'].includes(f.type)) {
          throw new Error(`Invalid field type '${f.type}'. Must be string, number, date, or currency.`);
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

      if (creditsData.credits < 1) {
        return NextResponse.json(
          { error: 'Insufficient credits. Please upgrade your plan.' },
          { status: 402 }
        );
      }
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract structured fields using Claude tool-calling
    const result = await extractFieldsFromPDF(buffer, fields);

    const fileName = (file as File).name || 'document.pdf';

    // Build response
    const response: any = {
      data: result,
      fileName,
    };

    // If export to CSV was requested, compile and upload
    if (exportCSV) {
      const documents: ProcessedDocument[] = [{
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        fileName,
        extractedAt: new Date().toISOString(),
        data: result,
      }];

      const csvBuffer = compileToCSV(documents, fields);

      const csvFileName = fileName
        .replace(/\.pdf$/i, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase() + '-extract.csv';

      const { url } = await uploadCSVAndGetURL(
        csvBuffer,
        csvFileName,
        userId || undefined
      );

      response.csvDownloadUrl = url;
    }

    // Deduct 1 credit from user
    if (userId) {
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/credits/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', amount: 1 }),
      });
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Extract API error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}