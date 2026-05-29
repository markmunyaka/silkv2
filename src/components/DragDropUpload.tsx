'use client';

import { useState, useCallback } from 'react';

interface DragDropUploadProps {
  onFileSelect?: (file: File) => void;
  onUpload?: (summary: string, textLength: number) => void;
  isProcessing?: boolean;
}

export default function DragDropUpload({ onFileSelect, onUpload, isProcessing }: DragDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError('File exceeds 100 MB limit');
      return;
    }

    setFileName(file.name);
    setError('');

    // If onFileSelect is provided, use it (preferred pattern)
    if (onFileSelect) {
      onFileSelect(file);
      return;
    }

    // Otherwise, process directly (legacy pattern)
    setLoading(true);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload failed');
      } else {
        onUpload?.(data.summary, data.textLength);
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [onFileSelect, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [processFile]);

  const isActive = isProcessing || loading;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative group cursor-pointer transition-all duration-300
        ${isDragging ? 'scale-105' : 'scale-100'}
      `}
    >
      {/* Glowing aura background */}
      <div
        className={`
          absolute inset-0 rounded-2xl blur-3xl transition-all duration-300
          ${isDragging
            ? 'opacity-100 bg-gradient-to-r from-accent-gold via-accent-neon-blue to-accent-gold'
            : 'opacity-0 bg-gradient-to-r from-accent-gold/50 via-accent-neon-blue/50 to-accent-gold/50'
          }
        `}
      />

      {/* Main card */}
      <div
        className={`
          relative glass-lg p-12 md:p-16 text-center rounded-2xl overflow-hidden
          border-2 transition-all duration-300
          ${isDragging
            ? 'border-accent-gold bg-accent-gold/10 animate-aura-glow'
            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
          }
          ${isActive ? 'opacity-60 pointer-events-none' : 'hover:shadow-2xl'}
        `}
      >
        {/* Gradient overlay on drag */}
        <div
          className={`
            absolute inset-0 bg-gradient-to-br from-accent-gold/5 to-accent-neon-blue/5
            transition-opacity duration-300 rounded-2xl
            ${isDragging ? 'opacity-100' : 'opacity-0'}
          `}
        />

        <input
          type="file"
          accept="application/pdf"
          onChange={handleChange}
          className="hidden"
          id="pdf-upload"
          disabled={isActive}
        />

        {isActive ? (
          <div className="space-y-6 relative z-10">
            <div className="flex justify-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-accent-gold border-r-accent-neon-blue animate-spin" />
                <div className="absolute inset-1 rounded-full border-2 border-accent-gold/20" />
              </div>
            </div>
            <div>
              <p className="text-accent-neon-blue text-lg font-medium">Processing your document...</p>
              <p className="text-foreground-secondary text-sm mt-2">
                Our AI is analyzing the content with precision
              </p>
            </div>
          </div>
        ) : (
          <div className="relative z-10">
            {/* Upload icon with enhanced styling */}
            <div className="mb-8 flex justify-center">
              <div
                className={`
                  p-6 rounded-full transition-all duration-300
                  ${isDragging
                    ? 'bg-gradient-to-br from-accent-gold/40 to-accent-neon-blue/40'
                    : 'bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/10'
                  }
                `}
              >
                <svg
                  className={`
                    w-16 h-16 transition-all duration-300
                    ${isDragging
                      ? 'text-accent-gold scale-125 drop-shadow-[0_0_30px_rgba(212,175,55,0.8)]'
                      : 'text-accent-neon-blue/70 scale-100'
                    }
                  `}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                  />
                </svg>
              </div>
            </div>

            {fileName ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3 mb-6 p-4 rounded-lg bg-accent-gold/10 border border-accent-gold/20">
                  <svg className="w-5 h-5 text-accent-gold flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 16c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm9-11H6v14h12V5zm3-1v15c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2z" />
                  </svg>
                  <p className="text-lg font-serif text-accent-gold truncate flex-1">{fileName}</p>
                </div>
                <p className="text-foreground-secondary text-sm">Ready to summarize</p>
              </div>
            ) : (
              <>
                <h3 className="text-3xl md:text-4xl font-serif text-white mb-4 leading-tight">
                  {isDragging ? (
                    <span className="bg-gradient-to-r from-accent-gold to-accent-neon-blue bg-clip-text text-transparent">
                      Release to Upload
                    </span>
                  ) : (
                    'Drag & Drop Your PDF'
                  )}
                </h3>
                <p className="text-foreground-secondary mb-4 text-base">
                  or{' '}
                  <label
                    htmlFor="pdf-upload"
                    className="text-accent-gold hover:text-accent-gold-light font-semibold cursor-pointer transition-colors duration-200"
                  >
                    browse your files
                  </label>
                </p>
                <p className="text-foreground-secondary text-sm">
                  Supports PDF up to 100 MB • Encrypted processing • Zero tracking
                </p>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="mt-8 relative z-10 p-4 bg-gradient-to-r from-red-950/80 to-red-900/80 border border-red-700/50 rounded-lg backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
