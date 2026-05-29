'use client';

import { useState, useCallback } from 'react';

interface ExtractionField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'currency';
}

interface ExtractionResult {
  data: Record<string, string | number | null>;
  fileName: string;
  csvDownloadUrl?: string;
}

export default function PDFDataExtractor({ userId }: { userId?: string }) {
  const [fields, setFields] = useState<ExtractionField[]>([
    { key: 'invoiceNumber', label: 'Invoice Number', type: 'string' },
    { key: 'totalAmount', label: 'Total Amount', type: 'currency' },
  ]);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState('');
  const [exportCSV, setExportCSV] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const addField = () => {
    const count = fields.length + 1;
    setFields([...fields, { key: `field${count}`, label: `Field ${count}`, type: 'string' }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<ExtractionField>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setResult(null);
      setError('');
    } else {
      setError('Please drop a PDF file');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.type !== 'application/pdf') {
        setError('Please select a PDF file');
        return;
      }
      setFile(selected);
      setResult(null);
      setError('');
    }
  };

  const handleExtract = async () => {
    if (!file) {
      setError('Please select a PDF file');
      return;
    }
    if (fields.length === 0) {
      setError('Please add at least one extraction field');
      return;
    }

    // Validate fields
    for (const f of fields) {
      if (!f.key.trim() || !f.label.trim()) {
        setError('All fields must have a key and label');
        return;
      }
    }

    setIsProcessing(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('fields', JSON.stringify(fields));
      formData.append('exportCSV', exportCSV ? 'true' : 'false');
      if (userId) formData.append('userId', userId);

      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Extraction failed');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Extraction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="glass-lg p-6 md:p-8 rounded-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-serif text-white mb-2">PDF Data Extractor</h2>
        <p className="text-foreground-secondary">
          Extract structured data from PDFs using AI. Define the fields you want to extract.
        </p>
      </div>

      {/* Field Definition */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif text-white">Fields to Extract</h3>
          <button
            onClick={addField}
            className="text-sm bg-accent-gold/20 hover:bg-accent-gold/30 text-accent-gold px-3 py-1.5 rounded-lg transition-all"
          >
            + Add Field
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
              <div className="flex-1 grid grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Key (e.g., invoiceNumber)"
                  value={field.key}
                  onChange={(e) => updateField(index, { key: e.target.value })}
                  className="bg-white/10 border border-white/20 rounded px-3 py-1.5 text-white text-sm placeholder:text-white/30 focus:border-accent-gold/50 outline-none"
                />
                <input
                  type="text"
                  placeholder="Label (e.g., Invoice Number)"
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  className="bg-white/10 border border-white/20 rounded px-3 py-1.5 text-white text-sm placeholder:text-white/30 focus:border-accent-gold/50 outline-none"
                />
                <div className="flex gap-2">
                  <select
                    value={field.type}
                    onChange={(e) => updateField(index, { type: e.target.value as ExtractionField['type'] })}
                    className="bg-white/10 border border-white/20 rounded px-3 py-1.5 text-white text-sm flex-1 focus:border-accent-gold/50 outline-none"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="currency">Currency</option>
                    <option value="date">Date</option>
                  </select>
                  {fields.length > 1 && (
                    <button
                      onClick={() => removeField(index)}
                      className="text-red-400 hover:text-red-300 px-2 py-1.5 text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* File Upload */}
      <div className="mb-8">
        <h3 className="text-lg font-serif text-white mb-4">Upload PDF</h3>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`
            relative p-8 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all
            ${isDragging
              ? 'border-accent-gold bg-accent-gold/10'
              : file ? 'border-accent-neon-blue/50 bg-white/5' : 'border-white/20 bg-white/5 hover:border-white/40'
            }
          `}
          onClick={() => document.getElementById('extract-pdf-input')?.click()}
        >
          <input
            id="extract-pdf-input"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">📄</span>
              <span className="text-accent-neon-blue font-medium">{file.name}</span>
              <span className="text-foreground-secondary text-sm">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="text-red-400 hover:text-red-300 text-sm ml-2"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <span className="text-3xl block mb-2">📁</span>
              <p className="text-foreground-secondary">
                {isDragging ? 'Release to upload' : 'Drag & drop a PDF, or click to browse'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="mb-8 flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={exportCSV}
            onChange={(e) => setExportCSV(e.target.checked)}
            className="rounded border-white/20 bg-white/10"
          />
          <span className="text-foreground-secondary text-sm">Export to CSV & get download link</span>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-950/80 border border-red-700/50 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Extract Button */}
      <button
        onClick={handleExtract}
        disabled={isProcessing || !file}
        className="w-full bg-gradient-to-r from-accent-gold to-accent-gold-light hover:from-accent-gold-light hover:to-accent-gold text-black font-bold py-3 px-6 rounded-lg transition-all duration-200 hover:shadow-xl hover:shadow-accent-gold/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-3">
            <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            Extracting with AI...
          </span>
        ) : (
          'Extract Data'
        )}
      </button>

      {/* Result */}
      {result && (
        <div className="mt-8 space-y-4 animate-fade-in-up">
          <div className="p-4 bg-accent-gold/10 border border-accent-gold/20 rounded-lg">
            <h3 className="text-accent-gold font-medium mb-2">✓ Extracted Data from {result.fileName}</h3>
            <pre className="text-white text-sm overflow-x-auto whitespace-pre-wrap font-mono bg-black/20 p-3 rounded">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>

          {result.csvDownloadUrl && (
            <a
              href={result.csvDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-gradient-to-r from-accent-neon-blue to-accent-gold text-black font-bold py-3 px-6 rounded-lg text-center hover:shadow-xl hover:shadow-accent-neon-blue/40 transition-all"
            >
              📥 Download CSV
            </a>
          )}
        </div>
      )}
    </div>
  );
}