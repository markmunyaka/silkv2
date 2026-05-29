'use client';

import { useState } from 'react';

interface ConversionOption {
  format: string;
  label: string;
  icon: string;
  description: string;
}

const CONVERSION_OPTIONS: ConversionOption[] = [
  { format: 'text', label: 'Text (.txt)', icon: '📄', description: 'Plain text format' },
  { format: 'json', label: 'JSON', icon: '🔗', description: 'Structured JSON data' },
  { format: 'csv', label: 'CSV', icon: '📊', description: 'Spreadsheet compatible' },
  { format: 'html', label: 'HTML', icon: '🌐', description: 'Web page format' },
  { format: 'markdown', label: 'Markdown', icon: '✍️', description: 'Markdown format' },
  { format: 'docx', label: 'Word (.docx)', icon: '📝', description: 'Word document' },
  { format: 'xlsx', label: 'Excel (.xlsx)', icon: '📈', description: 'Excel spreadsheet' },
  { format: 'pptx', label: 'PowerPoint (.pptx)', icon: '🎯', description: 'PowerPoint presentation' },
];

interface PDFConverterProps {
  file?: File;
  userId?: string;
  onConversionComplete?: (success: boolean, message: string) => void;
}

export default function PDFConverter({
  file: propFile,
  userId,
  onConversionComplete,
}: PDFConverterProps) {
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');
  const [localFile, setLocalFile] = useState<File | undefined>(propFile);
  const file = propFile || localFile;

  const handleConvert = async (format: string) => {
    if (!file || !userId) {
      setError('File and user ID are required');
      return;
    }

    setError('');
    setConverting(true);
    setSelectedFormat(format);

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('format', format);
      formData.append('userId', userId);

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Conversion failed');
      }

      // Check if response is binary (docx, xlsx, pptx)
      const contentType = response.headers.get('content-type') || '';
      const isBinary = contentType.includes('application/vnd.openxmlformats');

      if (isBinary) {
        // Handle binary file download
        const blob = await response.blob();
        const fileName = response.headers.get('content-disposition')?.split('filename="')[1]?.split('"')[0] || `file${getExtensionForFormat(format)}`;
        
        const element = document.createElement('a');
        element.setAttribute('href', URL.createObjectURL(blob));
        element.setAttribute('download', fileName);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(element.href);
      } else {
        // Handle text file download
        const data = await response.json();
        const element = document.createElement('a');
        element.setAttribute('href', `data:${data.mimeType};charset=utf-8,${encodeURIComponent(data.content)}`);
        element.setAttribute('download', data.fileName);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }

      onConversionComplete?.(true, `Successfully converted to ${format.toUpperCase()}`);
      setSelectedFormat('');
    } catch (err: any) {
      setError(err.message || 'Conversion failed');
      onConversionComplete?.(false, err.message || 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const getExtensionForFormat = (format: string): string => {
    const extensions: Record<string, string> = {
      text: '.txt',
      json: '.json',
      csv: '.csv',
      html: '.html',
      markdown: '.md',
      docx: '.docx',
      xlsx: '.xlsx',
      pptx: '.pptx',
    };
    return extensions[format] || '.bin';
  };

  return (
    <div className="glass-lg p-8 rounded-lg">
      <h3 className="text-2xl font-serif text-white mb-2">Convert PDF</h3>
      <p className="text-foreground-secondary mb-6">
        Download your PDF in different formats
      </p>

      {!file && (
        <div className="mb-4">
          <label className="block text-xs text-foreground-secondary mb-2 font-medium">Select a PDF to convert</label>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setLocalFile(f); setError(''); }
              // Reset input so the same file can be selected again
              e.target.value = '';
            }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-accent-gold file:text-black hover:file:bg-accent-gold-light transition-all cursor-pointer"
          />
        </div>
      )}

      {file && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10">
          <span className="text-lg">📄</span>
          <span className="text-sm text-white flex-1 truncate">{file.name}</span>
          <span className="text-[10px] text-foreground-secondary">{(file.size / 1024).toFixed(0)} KB</span>
          {propFile && (
            <button onClick={() => setLocalFile(undefined)} className="text-xs text-foreground-secondary hover:text-red-400 transition-colors">Remove</button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-950/80 border border-red-700/50 rounded-lg">
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}

      {file && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CONVERSION_OPTIONS.map((option) => (
          <button
            key={option.format}
            onClick={() => handleConvert(option.format)}
            disabled={converting}
            className={`relative overflow-hidden p-4 rounded-lg border-2 transition-all duration-300 group ${
              converting
                ? 'opacity-50 cursor-not-allowed border-white/5 bg-white/2'
                : 'border-white/10 bg-white/5 hover:border-accent-gold hover:bg-accent-gold/10 hover:shadow-lg hover:shadow-accent-gold/20 hover:-translate-y-1'
            } ${converting && selectedFormat === option.format ? 'scale-95' : ''}`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-accent-gold/0 to-accent-neon-blue/0 group-hover:from-accent-gold/5 group-hover:to-accent-neon-blue/5 transition-all" />
            <div className="relative z-10">
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                {option.icon}
              </div>
              <h4 className="font-serif text-white font-bold mb-1 group-hover:text-accent-gold transition-colors">
                {option.label}
              </h4>
              <p className="text-xs text-foreground-secondary group-hover:text-white transition-colors">
                {option.description}
              </p>
              {converting && selectedFormat === option.format && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-accent-gold">Converting...</span>
                </div>
              )}
            </div>
          </button>
          ))}
      </div>
      )}

      {!file && (
        <p className="text-[10px] text-foreground-secondary mt-2">Upload a PDF above to convert it to various formats</p>
      )}
    </div>
  );
}
