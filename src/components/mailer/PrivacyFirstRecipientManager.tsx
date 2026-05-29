'use client';

import { useState, useEffect } from 'react';

interface RecipientList {
  id: string;
  name: string;
  description?: string;
  totalCount: number;
  createdAt: string;
}

// Store recipient lists in localStorage for privacy
const STORAGE_KEY = 'silk_mailer_recipients';

function loadRecipientLists(): RecipientList[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveRecipientLists(lists: RecipientList[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
}

interface RecipientData {
  email: string;
  firstName?: string;
  lastName?: string;
}

// Store actual recipient emails separately (encrypted/local only)
const RECIPIENTS_KEY = 'silk_mailer_recipient_data';

function loadRecipients(): Record<string, RecipientData[]> {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem(RECIPIENTS_KEY);
  return stored ? JSON.parse(stored) : {};
}

function saveRecipients(data: Record<string, RecipientData[]>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RECIPIENTS_KEY, JSON.stringify(data));
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function parseCSV(csvText: string): RecipientData[] {
  const lines = csvText.trim().split('\n');
  const result: RecipientData[] = [];

  lines.forEach((line, index) => {
    if (index === 0 && (line.includes('email') || line.includes('Email'))) {
      return;
    }

    const columns = line.split(',').map(col => col.trim());
    if (columns.length > 0 && validateEmail(columns[0])) {
      result.push({
        email: columns[0],
        firstName: columns[1] || undefined,
        lastName: columns[2] || undefined,
      });
    }
  });

  return result;
}

function CSVUploader({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [csvData, setCsvData] = useState('');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvData(text);
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv' || file.type === 'text/plain')) {
      handleFileRead(file);
    } else {
      setError('Please upload a CSV file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileRead(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !csvData) {
      setError('Please fill in list name and add CSV data');
      return;
    }

    const recipients = parseCSV(csvData);
    if (recipients.length === 0) {
      setError('No valid emails found');
      return;
    }

    const lists = loadRecipientLists();
    const allRecipients = loadRecipients();
    const newListId = `list_${Date.now()}`;
    
    const newList: RecipientList = {
      id: newListId,
      name,
      description,
      totalCount: recipients.length,
      createdAt: new Date().toISOString(),
    };

    allRecipients[newListId] = recipients;
    saveRecipients(allRecipients);
    saveRecipientLists([newList, ...lists]);
    
    onSuccess();
  };

  return (
    <div className="glass-lg rounded-xl p-6">
      <h2 className="text-xl font-serif text-white mb-6">Import Recipients (Privacy-Safe)</h2>
      
      <div className="bg-accent-gold/10 border border-accent-gold/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-accent-gold">
          🔒 <strong>Privacy First:</strong> Recipients are stored locally in your browser only. 
          They are never sent to or stored on our servers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">
            List Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Q1 2024 Leads"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">
            Description (Optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Leads from webinar campaign"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">
            CSV File
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Drag & drop a CSV file or click to browse. Format: email, firstName (optional), lastName (optional)
          </p>
          
          {/* Drag & Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
              ${isDragging 
                ? 'border-accent-gold bg-accent-gold/20' 
                : csvData 
                  ? 'border-green-500/50 bg-green-500/10' 
                  : 'border-white/20 bg-white/5 hover:border-white/40'
              }
            `}
            onClick={() => document.getElementById('csv-file-input')?.click()}
          >
            <input
              type="file"
              id="csv-file-input"
              accept=".csv,text/csv,text/plain"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {fileName ? (
              <div className="space-y-2">
                <div className="text-green-400 text-4xl">✓</div>
                <p className="text-green-400 font-medium">{fileName}</p>
                <p className="text-xs text-slate-400">{csvData.split('\n').length - 1} rows detected</p>
                <p className="text-xs text-slate-500">Click to replace</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">📄</div>
                <p className="text-white font-medium">Drop CSV file here</p>
                <p className="text-xs text-slate-400">or click to browse</p>
              </div>
            )}
          </div>
        </div>

        {/* Manual Entry / Preview */}
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">
            Or Paste CSV Data
          </label>
          <textarea
            value={csvData}
            onChange={(e) => {
              setCsvData(e.target.value);
              setFileName(null);
            }}
            placeholder="email,firstName,lastName
john@example.com,John,Doe
jane@example.com,Jane,Smith"
            rows={6}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/20"
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
            disabled={!csvData}
            className="flex-1 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-4 py-2.5 font-medium text-black transition-all hover:shadow-lg hover:shadow-accent-gold/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import Locally
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 font-medium text-foreground-secondary transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function RecipientListView({ list }: { list: RecipientList }) {
  const allRecipients = loadRecipients();
  const recipients = allRecipients[list.id] || [];

  return (
    <div className="glass-lg rounded-xl p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-serif text-white">{list.name}</h2>
          {list.description && (
            <p className="text-sm text-slate-400 mt-1">{list.description}</p>
          )}
        </div>
        <span className="px-3 py-1 bg-accent-gold/20 text-accent-gold rounded-full text-sm">
          {list.totalCount} recipients
        </span>
      </div>

      <div className="bg-accent-gold/10 border border-accent-gold/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-accent-gold">
          🔒 Privacy: This list is stored locally. Recipients are never sent to our servers.
        </p>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10">
            <tr className="text-slate-400 text-left">
              <th className="pb-3">Email</th>
              <th className="pb-3">Name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {recipients.slice(0, 50).map((r, i) => (
              <tr key={i} className="text-white">
                <td className="py-3">{r.email}</td>
                <td className="py-3 text-slate-400">
                  {[r.firstName, r.lastName].filter(Boolean).join(' ') || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recipients.length > 50 && (
          <p className="text-center text-slate-500 mt-4">
            Showing 50 of {recipients.length} recipients
          </p>
        )}
      </div>
    </div>
  );
}

export default function RecipientManager() {
  const [recipientLists, setRecipientLists] = useState<RecipientList[]>([]);
  const [selectedList, setSelectedList] = useState<RecipientList | null>(null);
  const [showUploader, setShowUploader] = useState(false);

  useEffect(() => {
    setRecipientLists(loadRecipientLists());
  }, []);

  const handleUploadSuccess = () => {
    setRecipientLists(loadRecipientLists());
    setShowUploader(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: List */}
      <div className="lg:col-span-1">
        <div className="glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 p-4">
            <button
              onClick={() => setShowUploader(true)}
              className="w-full rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-4 py-2.5 font-medium text-black transition-all hover:shadow-lg hover:shadow-accent-gold/30"
            >
              + Import Recipients
            </button>
          </div>

          <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
            {recipientLists.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <p>No recipient lists</p>
                <p className="text-xs mt-2">All data stored locally</p>
              </div>
            ) : (
              recipientLists.map(list => (
                <div
                  key={list.id}
                  onClick={() => setSelectedList(list)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedList?.id === list.id
                      ? 'border-accent-gold/50 bg-accent-gold/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <h3 className="font-medium text-white">{list.name}</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {list.totalCount} recipient{list.totalCount !== 1 ? 's' : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right: Upload or Details */}
      <div className="lg:col-span-2">
        {showUploader ? (
          <CSVUploader onSuccess={handleUploadSuccess} onCancel={() => setShowUploader(false)} />
        ) : selectedList ? (
          <RecipientListView list={selectedList} />
        ) : (
          <div className="glass rounded-xl px-6 py-12 text-center">
            <p className="text-slate-400">Import recipient lists or select one to view</p>
            <p className="text-xs text-slate-500 mt-2">🔒 All recipient data stored locally in your browser</p>
          </div>
        )}
      </div>
    </div>
  );
}