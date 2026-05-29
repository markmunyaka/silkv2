'use client';

import { useState, useRef } from 'react';

interface CSVUploaderProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CSVUploader({ onSuccess, onCancel }: CSVUploaderProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [csvData, setCSVData] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCSVData(event.target?.result as string);
      setError('');
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !csvData) {
      setError('Please fill in list name and upload a CSV file');
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch('/api/mailer/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          csvData,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to import recipients');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import recipients');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur">
      <div className="border-b border-slate-700 px-6 py-4">
        <h2 className="text-lg font-semibold text-white">Import Recipients</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            List Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Q1 2024 Leads"
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Description (Optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Leads from webinar campaign"
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            CSV File Upload
          </label>
          <p className="text-xs text-slate-400 mb-3">
            CSV format: email, firstName (optional), lastName (optional)
          </p>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-slate-600 px-6 py-8 text-center transition-colors hover:border-blue-500"
            >
              <svg className="mx-auto h-8 w-8 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <p className="text-slate-300">Click to upload or paste CSV</p>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            CSV Preview
          </label>
          <textarea
            value={csvData}
            onChange={(e) => setCSVData(e.target.value)}
            placeholder="email,firstName,lastName
john@example.com,John,Doe
jane@example.com,Jane,Smith"
            rows={8}
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 font-mono text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-800/50 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isUploading}
            className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 font-medium text-white transition-all hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50"
          >
            {isUploading ? 'Importing...' : 'Import Recipients'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 font-medium text-slate-300 transition-colors hover:bg-slate-700/50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
