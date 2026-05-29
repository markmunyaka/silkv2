import pdfParse from 'pdf-parse';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';

export type ConversionFormat = 'text' | 'docx' | 'xlsx' | 'pptx' | 'csv' | 'json' | 'html' | 'markdown';

/**
 * Convert PDF to plain text
 */
export async function convertToText(fileBuffer: Buffer): Promise<string> {
  try {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Invalid PDF buffer provided');
    }
    const data = await pdfParse(fileBuffer);
    if (!data.text) {
      throw new Error('No text extracted from PDF');
    }
    return data.text;
  } catch (error: any) {
    throw new Error(`Failed to convert PDF to text: ${error.message}`);
  }
}

/**
 * Convert PDF to JSON format
 */
export async function convertToJson(fileBuffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(fileBuffer);
    const jsonData = {
      pages: data.numpages,
      text: data.text,
      metadata: data.metadata,
      creationDate: data.info?.CreationDate,
      producer: data.info?.Producer,
      extractedAt: new Date().toISOString(),
    };
    return JSON.stringify(jsonData, null, 2);
  } catch (error: any) {
    throw new Error(`Failed to convert PDF to JSON: ${error.message}`);
  }
}

/**
 * Convert PDF to CSV format
 */
export async function convertToCsv(fileBuffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(fileBuffer);
    const lines = data.text.split('\n').filter((line) => line.trim());
    const csvContent = lines.map((line) => `"${line.replace(/"/g, '""')}"`).join('\n');
    return csvContent;
  } catch (error: any) {
    throw new Error(`Failed to convert PDF to CSV: ${error.message}`);
  }
}

/**
 * Sanitize text for HTML to prevent XSS
 */
function sanitizeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Convert PDF to HTML format
 */
export async function convertToHtml(fileBuffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(fileBuffer);
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF Converted to HTML</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
      color: #333;
    }
    .header {
      background-color: #2c3e50;
      color: white;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .content {
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .meta {
      color: #666;
      font-size: 12px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>PDF Document Conversion</h1>
    <p>Pages: ${data.numpages}</p>
  </div>
  <div class="content">
${sanitizeHtml(data.text)}
  </div>
  <div class="meta">
    <p>Converted on: ${new Date().toISOString()}</p>
    <p>Total Pages: ${data.numpages}</p>
  </div>
</body>
</html>
    `;
    return htmlContent;
  } catch (error: any) {
    throw new Error(`Failed to convert PDF to HTML: ${error.message}`);
  }
}

/**
 * Convert PDF to Markdown format
 */
export async function convertToMarkdown(fileBuffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(fileBuffer);
    const markdownContent = `# PDF Document

**Document Information:**
- Pages: ${data.numpages}
- Extracted at: ${new Date().toISOString()}

## Content

\`\`\`
${data.text}
\`\`\`

---

*Converted from PDF*
    `;
    return markdownContent;
  } catch (error: any) {
    throw new Error(`Failed to convert PDF to Markdown: ${error.message}`);
  }
}

/**
 * Convert PDF to DOCX format
 */
export async function convertToDocx(fileBuffer: Buffer): Promise<Buffer> {
  try {
    const data = await pdfParse(fileBuffer);
    const paragraphs = data.text
      .split('\n')
      .filter((line) => line.trim())
      .map(
        (line) =>
          new Paragraph({
            text: line,
            spacing: { line: 240 },
          })
      );

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: 'PDF Document',
              spacing: { before: 200, after: 200 },
              size: 32,
              bold: true,
            }),
            new Paragraph({
              text: `Pages: ${data.numpages}`,
              spacing: { after: 100 },
              size: 22,
            }),
            new Paragraph({
              text: `Converted at: ${new Date().toISOString()}`,
              spacing: { after: 400 },
              size: 22,
            }),
            ...paragraphs,
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer;
  } catch (error: any) {
    throw new Error(`Failed to convert PDF to DOCX: ${error.message}`);
  }
}

/**
 * Convert PDF to XLSX format
 */
export async function convertToXlsx(fileBuffer: Buffer): Promise<Buffer> {
  try {
    const data = await pdfParse(fileBuffer);
    const lines = data.text.split('\n').filter((line) => line.trim());

    const workbook = XLSX.utils.book_new();
    const sheetData = [
      ['PDF Content'],
      ['Extracted Text'],
      ...lines.map((line) => [line]),
    ];

    const metadata = [['Document Metadata'], ['Pages', data.numpages], ['Converted At', new Date().toISOString()]];

    const contentSheet = XLSX.utils.aoa_to_sheet(sheetData);
    const metadataSheet = XLSX.utils.aoa_to_sheet(metadata);

    XLSX.utils.book_append_sheet(workbook, contentSheet, 'Content');
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    return buffer as Buffer;
  } catch (error: any) {
    throw new Error(`Failed to convert PDF to XLSX: ${error.message}`);
  }
}

/**
 * Convert PDF to PPTX format
 */
export async function convertToPptx(fileBuffer: Buffer): Promise<Buffer> {
  try {
    const data = await pdfParse(fileBuffer);
    const prs = new PptxGenJS();

    prs.defineLayout({
      name: 'LAYOUT1',
      master: 'MASTER1',
    });

    // Title slide
    const titleSlide = prs.addSlide();
    titleSlide.background = { color: '1a365d' };
    titleSlide.addText('PDF Conversion', {
      x: 0.5,
      y: 2,
      w: 9,
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
    });

    titleSlide.addText(`Pages: ${data.numpages}`, {
      x: 0.5,
      y: 3.7,
      w: 9,
      h: 0.5,
      fontSize: 18,
      color: 'CCCCCC',
      align: 'center',
    });

    // Content slides
    const lines = data.text.split('\n').filter((line) => line.trim());
    const chunkSize = 10;

    for (let i = 0; i < lines.length; i += chunkSize) {
      const slide = prs.addSlide();
      slide.background = { color: 'FFFFFF' };

      slide.addText(`Content - Part ${Math.floor(i / chunkSize) + 1}`, {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.4,
        fontSize: 24,
        bold: true,
        color: '1a365d',
      });

      const chunkText = lines.slice(i, i + chunkSize).join('\n');
      slide.addText(chunkText, {
        x: 0.5,
        y: 1,
        w: 9,
        h: 5.5,
        fontSize: 12,
        color: '333333',
      });
    }

    const buffer = await prs.writeBuffer();
    return buffer as Buffer;
  } catch (error: any) {
    throw new Error(`Failed to convert PDF to PPTX: ${error.message}`);
  }
}

/**
 * Main converter function
 */
export async function convertPdf(
  fileBuffer: Buffer,
  format: ConversionFormat
): Promise<{ content: string | Buffer; mimeType: string; extension: string }> {
  let content: string | Buffer;
  let mimeType: string;
  let extension: string;

  switch (format) {
    case 'text':
      content = await convertToText(fileBuffer);
      mimeType = 'text/plain';
      extension = '.txt';
      break;

    case 'json':
      content = await convertToJson(fileBuffer);
      mimeType = 'application/json';
      extension = '.json';
      break;

    case 'csv':
      content = await convertToCsv(fileBuffer);
      mimeType = 'text/csv';
      extension = '.csv';
      break;

    case 'html':
      content = await convertToHtml(fileBuffer);
      mimeType = 'text/html';
      extension = '.html';
      break;

    case 'markdown':
      content = await convertToMarkdown(fileBuffer);
      mimeType = 'text/markdown';
      extension = '.md';
      break;

    case 'docx':
      content = await convertToDocx(fileBuffer);
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      extension = '.docx';
      break;

    case 'xlsx':
      content = await convertToXlsx(fileBuffer);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = '.xlsx';
      break;

    case 'pptx':
      content = await convertToPptx(fileBuffer);
      mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      extension = '.pptx';
      break;

    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  return { content, mimeType, extension };
}
