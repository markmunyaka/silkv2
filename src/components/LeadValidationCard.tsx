'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationResult {
  email: string;
  isValid: boolean;
  score: number;
  isDisposable: boolean;
  reason: string;
  deliverability: string;
  isFormatValid: boolean;
  isFreeEmail: boolean;
  isRoleEmail: boolean;
  isCatchallEmail: boolean;
  isMxFound: boolean;
  isSmtpValid: boolean;
}

interface BatchResults {
  total: number;
  valid: number;
  invalid: number;
  disposable: number;
  results: ValidationResult[];
}

type Mode = 'single' | 'bulk' | 'phone';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract all email addresses from a blob of text. */
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches ? [...new Set(matches.map((e) => e.toLowerCase()))] : [];
}

/** Parse a CSV file and extract email addresses from any column. */
async function parseCSV(file: File): Promise<string[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  // Try to find the email column header
  const header = lines[0].toLowerCase();
  const separators = [',', '\t', ';', '|'];
  
  // Detect separator by counting occurrences in header
  let sep = ',';
  let maxCount = 0;
  for (const s of separators) {
    const count = (header.match(new RegExp(s === '|' ? '\\|' : s, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      sep = s;
    }
  }

  // Find email column index
  const headerCols = header.split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ''));
  let emailColIdx = headerCols.findIndex(
    (c) => c === 'email' || c === 'e-mail' || c === 'mail' || c === 'email address' || c.includes('@')
  );

  const emails: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ''));

    if (emailColIdx >= 0 && cols[emailColIdx]) {
      // Extract from the identified email column
      const extracted = extractEmails(cols[emailColIdx]);
      emails.push(...extracted);
    } else {
      // No email column found — scan all columns for anything that looks like an email
      for (const col of cols) {
        const extracted = extractEmails(col);
        emails.push(...extracted);
      }
    }
  }

  return [...new Set(emails.map((e) => e.toLowerCase()))];
}

/** Trigger a file download in the browser. */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LeadValidationCard() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode
  const [mode, setMode] = useState<Mode>('single');

  // Single mode
  const [email, setEmail] = useState('');
  const [singleResult, setSingleResult] = useState<ValidationResult | null>(null);
  const [validatedHistory, setValidatedHistory] = useState<ValidationResult[]>([]);

  // Bulk mode
  const [bulkInput, setBulkInput] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [batchResults, setBatchResults] = useState<BatchResults | null>(null);
  const [bulkFilter, setBulkFilter] = useState<'all' | 'valid' | 'invalid' | 'disposable'>('all');

  // Phone mode
  const [phone, setPhone] = useState('');
  const [phoneResult, setPhoneResult] = useState<{
    phone: string;
    isValid: boolean;
    internationalFormat: string;
    localFormat: string;
    countryCode: string;
    countryName: string;
    countryPrefix: string;
    location: string;
    carrier: string;
    lineType: string;
    reason: string;
  } | null>(null);

  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // -----------------------------------------------------------------------
  // Phone validation
  // -----------------------------------------------------------------------
  const handlePhoneValidate = useCallback(async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) return;
    if (!user?.id) {
      setError('You must be logged in to validate phone numbers.');
      return;
    }

    setLoading(true);
    setError('');
    setPhoneResult(null);

    try {
      const res = await fetch('/api/leads/validate/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmedPhone, workspaceId: user.id }),
      });

      const data = await res.json();

      if (data.data) {
        setPhoneResult(data.data);
        if (data.error) {
          setError(data.error);
        }
      } else {
        setError(data.error || 'Phone validation failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [phone, user?.id]);

  // -----------------------------------------------------------------------
  // Single validation
  // -----------------------------------------------------------------------
  const handleSingleValidate = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    if (!user?.id) {
      setError('You must be logged in to validate emails.');
      return;
    }

    setLoading(true);
    setError('');
    setSingleResult(null);

    try {
      const res = await fetch('/api/leads/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, workspaceId: user.id }),
      });

      const data = await res.json();

      // Always show structured data (even for invalid emails) so the detail grid is visible
      if (data.data) {
        setSingleResult(data.data);
        setValidatedHistory((prev) => {
          const exists = prev.some((r) => r.email === data.data.email);
          return exists ? prev : [data.data, ...prev];
        });
        // If there's also an error message, show it above the detail grid
        if (data.error) {
          setError(data.error);
        }
      } else {
        setError(data.error || 'Validation failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [email, user?.id]);

  // -----------------------------------------------------------------------
  // Bulk validation
  // -----------------------------------------------------------------------
  const handleBulkValidate = useCallback(async () => {
    const parsed = extractEmails(bulkInput);
    if (parsed.length === 0) {
      setError('No valid email addresses found in the input.');
      return;
    }
    if (!user?.id) {
      setError('You must be logged in to validate emails.');
      return;
    }

    setLoading(true);
    setError('');
    setBatchResults(null);

    try {
      const res = await fetch('/api/leads/validate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: parsed, workspaceId: user.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Batch validation failed');
      }

      setBatchResults(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [bulkInput, user?.id]);

  // -----------------------------------------------------------------------
  // CSV Upload
  // -----------------------------------------------------------------------
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError('');
    setUploadedFileName(file.name);

    try {
      const emails = await parseCSV(file);
      if (emails.length === 0) {
        setError('No email addresses found in the CSV file.');
        setUploadedFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setBulkInput(emails.join('\n'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file.');
      setUploadedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // -----------------------------------------------------------------------
  // Export — only valid leads
  // -----------------------------------------------------------------------
  const handleExportValidCSV = () => {
    if (!batchResults) return;
    const valid = batchResults.results.filter((r) => r.isValid);
    if (valid.length === 0) return;

    // Full CSV with all columns for the valid leads
    const header = 'email,score,isDisposable,reason';
    const rows = valid.map(
      (r) => `${r.email},${r.score},${r.isDisposable},"${r.reason.replace(/"/g, '""')}"`
    );
    const csv = [header, ...rows].join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadFile(csv, `valid-leads-${timestamp}.csv`, 'text/csv');
  };

  const handleExportValidTXT = () => {
    if (!batchResults) return;
    const valid = batchResults.results.filter((r) => r.isValid);
    if (valid.length === 0) return;

    const text = valid.map((r) => r.email).join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadFile(text, `valid-leads-${timestamp}.txt`, 'text/plain');
  };

  // -----------------------------------------------------------------------
  // Filtered results (bulk)
  // -----------------------------------------------------------------------
  const filteredResults = batchResults
    ? batchResults.results.filter((r) => {
        if (bulkFilter === 'valid') return r.isValid;
        if (bulkFilter === 'invalid') return !r.isValid && !r.isDisposable;
        if (bulkFilter === 'disposable') return r.isDisposable;
        return true;
      })
    : [];

  const validCount = batchResults?.valid ?? 0;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="glass-lg p-6 rounded-lg">
      {/* Header */}
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
        <span>✉️</span> Validate Email Lead
      </h3>
      <p className="text-foreground-secondary text-sm mb-4">
        Check if email addresses are valid, deliverable, and not disposable burners
      </p>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4 bg-white/5 rounded-lg p-1 w-fit">
        <button
          onClick={() => { setMode('single'); setError(''); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            mode === 'single'
              ? 'bg-accent-gold text-black shadow-lg shadow-accent-gold/30'
              : 'text-foreground-secondary hover:text-white'
          }`}
        >
          Email
        </button>
        <button
          onClick={() => { setMode('phone'); setError(''); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            mode === 'phone'
              ? 'bg-accent-gold text-black shadow-lg shadow-accent-gold/30'
              : 'text-foreground-secondary hover:text-white'
          }`}
        >
          Phone
        </button>
        <button
          onClick={() => { setMode('bulk'); setError(''); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            mode === 'bulk'
              ? 'bg-accent-gold text-black shadow-lg shadow-accent-gold/30'
              : 'text-foreground-secondary hover:text-white'
          }`}
        >
          Bulk
        </button>
      </div>

      {/* ---- Single Mode ---- */}
      {mode === 'single' && (
        <>
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              placeholder="e.g. john@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleSingleValidate(); }}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-foreground-secondary/50 focus:outline-none focus:border-accent-gold transition-colors text-sm"
              disabled={loading}
            />
            <button
              onClick={handleSingleValidate}
              disabled={loading || !email.trim()}
              className="bg-gradient-to-r from-accent-gold to-accent-gold-light hover:from-accent-gold-light hover:to-accent-gold text-black font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:shadow-xl hover:shadow-accent-gold/40 disabled:opacity-40 disabled:cursor-not-allowed text-sm whitespace-nowrap"
            >
              {loading ? 'Checking...' : '✓ Check'}
            </button>
          </div>

          {/* Single Result — full detail */}
          {singleResult && !error && (
            <div
              className={`p-4 rounded-lg border mb-4 transition-all ${
                singleResult.isValid
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              {/* Email + verdict */}
              <div className="flex items-center gap-2 mb-2">
                <span className={singleResult.isValid ? 'text-emerald-400 text-lg' : 'text-red-400 text-lg'}>
                  {singleResult.isValid ? '✅' : '❌'}
                </span>
                <span className="text-white font-medium break-all">{singleResult.email}</span>
              </div>

              {/* Reason */}
              <p className={`text-xs mb-3 ${singleResult.isValid ? 'text-emerald-300' : 'text-red-300'}`}>
                {singleResult.reason}
              </p>

              {/* Detail grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Score</span>
                  <span className={`font-mono font-bold ${singleResult.isValid ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(singleResult.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Deliverability</span>
                  <span className={`font-semibold ${
                    singleResult.deliverability === 'DELIVERABLE' ? 'text-emerald-400' :
                    singleResult.deliverability === 'RISKY' ? 'text-amber-400' :
                    singleResult.deliverability === 'UNDELIVERABLE' ? 'text-red-400' : 'text-foreground-secondary'
                  }`}>
                    {singleResult.deliverability}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Format</span>
                  <span className={singleResult.isFormatValid ? 'text-emerald-400' : 'text-red-400'}>
                    {singleResult.isFormatValid ? 'Valid' : 'Invalid'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Account Type</span>
                  <span className={singleResult.isFreeEmail ? 'text-amber-400' : 'text-emerald-400'}>
                    {singleResult.isFreeEmail ? 'Free' : 'Business'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Role Email</span>
                  <span className={singleResult.isRoleEmail ? 'text-amber-400' : 'text-emerald-400'}>
                    {singleResult.isRoleEmail ? '⚠️ Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Catch-all</span>
                  <span className={singleResult.isCatchallEmail ? 'text-amber-400' : 'text-emerald-400'}>
                    {singleResult.isCatchallEmail ? '⚠️ Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">MX Records</span>
                  <span className={singleResult.isMxFound ? 'text-emerald-400' : 'text-red-400'}>
                    {singleResult.isMxFound ? '✅ Found' : '❌ None'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">SMTP Valid</span>
                  <span className={singleResult.isSmtpValid ? 'text-emerald-400' : 'text-red-400'}>
                    {singleResult.isSmtpValid ? '✅ Yes' : '❌ No'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* History */}
          {validatedHistory.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-foreground-secondary font-medium uppercase tracking-wider">
                  History ({validatedHistory.length})
                </span>
                <button
                  onClick={() => { setValidatedHistory([]); setSingleResult(null); }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {validatedHistory.map((item, idx) => (
                  <div
                    key={`${item.email}-${idx}`}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs border cursor-pointer transition-colors hover:bg-white/5 ${
                      item.isValid
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : 'border-red-500/20 bg-red-500/5'
                    }`}
                    onClick={() => {
                      setEmail(item.email);
                      setSingleResult(item);
                      setError('');
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{item.isValid ? '✅' : '❌'}</span>
                      <span className="text-white truncate">{item.email}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <span className={`font-mono ${item.isValid ? 'text-emerald-400' : 'text-red-400'}`}>
                        {item.score.toFixed(2)}
                      </span>
                      {item.isDisposable && (
                        <span className="text-red-400 text-[10px] font-medium">BURNER</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single empty state */}
          {!singleResult && !loading && !error && validatedHistory.length === 0 && (
            <div className="text-center py-8 border border-dashed border-white/10 rounded-lg">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-foreground-secondary text-sm">Enter an email address to validate</p>
              <p className="text-foreground-secondary text-xs mt-1">Checks syntax, disposable domains & deliverability</p>
            </div>
          )}
        </>
      )}

      {/* ---- Phone Mode ---- */}
      {mode === 'phone' && (
        <>
          <div className="flex gap-2 mb-4">
            <input
              type="tel"
              placeholder="e.g. +1 415-200-7986"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handlePhoneValidate(); }}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-foreground-secondary/50 focus:outline-none focus:border-accent-gold transition-colors text-sm"
              disabled={loading}
            />
            <button
              onClick={handlePhoneValidate}
              disabled={loading || !phone.trim()}
              className="bg-gradient-to-r from-accent-gold to-accent-gold-light hover:from-accent-gold-light hover:to-accent-gold text-black font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:shadow-xl hover:shadow-accent-gold/40 disabled:opacity-40 disabled:cursor-not-allowed text-sm whitespace-nowrap"
            >
              {loading ? 'Checking...' : '📞 Lookup'}
            </button>
          </div>

          {/* Phone Result */}
          {phoneResult && (
            <div
              className={`p-4 rounded-lg border mb-4 transition-all ${
                phoneResult.isValid
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              {/* Number + verdict */}
              <div className="flex items-center gap-2 mb-2">
                <span className={phoneResult.isValid ? 'text-emerald-400 text-lg' : 'text-red-400 text-lg'}>
                  {phoneResult.isValid ? '✅' : '❌'}
                </span>
                <span className="text-white font-medium">{phoneResult.internationalFormat || phoneResult.phone}</span>
              </div>

              <p className={`text-xs mb-3 ${phoneResult.isValid ? 'text-emerald-300' : 'text-red-300'}`}>
                {phoneResult.reason}
              </p>

              {/* Phone detail grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Line Type</span>
                  <span className={`font-semibold capitalize ${
                    phoneResult.lineType === 'mobile' ? 'text-emerald-400' :
                    phoneResult.lineType === 'landline' ? 'text-amber-400' :
                    phoneResult.lineType === 'voip' ? 'text-accent-neon-blue' :
                    'text-foreground-secondary'
                  }`}>
                    {phoneResult.lineType}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Country</span>
                  <span className="text-white">
                    {phoneResult.countryName || '—'} {phoneResult.countryPrefix}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Location</span>
                  <span className="text-white truncate max-w-[120px] text-right">
                    {phoneResult.location || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Carrier</span>
                  <span className="text-white truncate max-w-[120px] text-right">
                    {phoneResult.carrier || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Local Format</span>
                  <span className="text-white text-right">{phoneResult.localFormat}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">International</span>
                  <span className="text-white text-right">{phoneResult.internationalFormat}</span>
                </div>
              </div>
            </div>
          )}

          {/* Phone empty state */}
          {!phoneResult && !loading && !error && (
            <div className="text-center py-8 border border-dashed border-white/10 rounded-lg">
              <div className="text-3xl mb-2">📞</div>
              <p className="text-foreground-secondary text-sm">Enter a phone number to look up</p>
              <p className="text-foreground-secondary text-xs mt-1">Returns carrier, location, line type & country info</p>
            </div>
          )}
        </>
      )}

      {/* ---- Bulk Mode ---- */}
      {mode === 'bulk' && (
        <>
          {/* CSV Upload */}
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={triggerFileUpload}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-accent-gold/50 transition-all text-sm text-foreground-secondary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="text-lg">📂</span>
              {uploadedFileName ? `Re-upload CSV: ${uploadedFileName}` : 'Upload CSV file to validate'}
            </button>
            {uploadedFileName && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-emerald-400">✅ {uploadedFileName} loaded</span>
                <button
                  onClick={() => { setUploadedFileName(''); setBulkInput(''); }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Textarea input */}
          <div className="mb-4">
            <textarea
              rows={5}
              placeholder={
                uploadedFileName
                  ? `${extractEmails(bulkInput).length} emails loaded from CSV — edit or press Validate All`
                  : 'Or paste emails here, one per line:\n\njohn@company.com\njane@business.org\nsupport@10minutemail.com'
              }
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-foreground-secondary/50 focus:outline-none focus:border-accent-gold transition-colors text-sm resize-vertical font-mono"
              disabled={loading}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-foreground-secondary">
                {bulkInput.trim() ? `${extractEmails(bulkInput).length} emails detected` : 'Separate by newline, comma, or semicolon'}
              </span>
              <button
                onClick={handleBulkValidate}
                disabled={loading || !bulkInput.trim()}
                className="bg-gradient-to-r from-accent-gold to-accent-gold-light hover:from-accent-gold-light hover:to-accent-gold text-black font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:shadow-xl hover:shadow-accent-gold/40 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                {loading ? `Validating ${extractEmails(bulkInput).length}...` : '📋 Validate All'}
              </button>
            </div>
          </div>

          {/* Bulk Results */}
          {batchResults && !error && (
            <div className="space-y-3">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs">
                  <span className="text-foreground-secondary">Total: </span>
                  <span className="text-white font-bold">{batchResults.total}</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs">
                  <span className="text-emerald-300">Valid: </span>
                  <span className="text-emerald-400 font-bold">{batchResults.valid}</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs">
                  <span className="text-red-300">Invalid: </span>
                  <span className="text-red-400 font-bold">{batchResults.invalid}</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs">
                  <span className="text-red-300">Disposable: </span>
                  <span className="text-red-400 font-bold">{batchResults.disposable}</span>
                </div>
              </div>

              {/* Filters + Export Valid Leads */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1">
                  {(['all', 'valid', 'invalid', 'disposable'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setBulkFilter(f)}
                      className={`px-2 py-1 rounded text-xs font-medium capitalize transition-all ${
                        bulkFilter === f
                          ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/40'
                          : 'text-foreground-secondary hover:text-white border border-transparent'
                      }`}
                    >
                      {f} ({f === 'all' ? batchResults.total : batchResults[f]})
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportValidCSV}
                    disabled={validCount === 0}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                    title="Download only the valid leads as CSV"
                  >
                    📥 Export Valid Leads ({validCount})
                  </button>
                  {validCount > 0 && (
                    <button
                      onClick={handleExportValidTXT}
                      className="px-2 py-1 rounded text-xs font-medium bg-white/5 border border-white/10 text-foreground-secondary hover:text-white hover:border-white/30 transition-all"
                      title="Download only the valid email addresses as plain text"
                    >
                      .txt
                    </button>
                  )}
                </div>
              </div>

              {/* Results table */}
              {filteredResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background-secondary">
                      <tr className="text-foreground-secondary text-xs uppercase tracking-wider">
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Email</th>
                        <th className="p-2 text-left hidden sm:table-cell">Score</th>
                        <th className="p-2 text-left hidden md:table-cell">Type</th>
                        <th className="p-2 text-left hidden lg:table-cell">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((r, idx) => (
                        <tr
                          key={`${r.email}-${idx}`}
                          className={`border-t border-white/5 hover:bg-white/5 transition-colors ${
                            r.isValid ? '' : 'opacity-80'
                          }`}
                        >
                          <td className="p-2 text-center">
                            {r.isValid ? (
                              <span className="text-emerald-400" title="Valid">✅</span>
                            ) : r.isDisposable ? (
                              <span className="text-red-400" title="Disposable">🚫</span>
                            ) : (
                              <span className="text-red-400" title="Invalid">❌</span>
                            )}
                          </td>
                          <td className={`p-2 font-medium ${r.isValid ? 'text-white' : 'text-foreground-secondary'}`}>
                            {r.email}
                          </td>
                          <td className={`p-2 font-mono hidden sm:table-cell ${r.isValid ? 'text-emerald-400' : 'text-red-400'}`}>
                            {r.score.toFixed(2)}
                          </td>
                          <td className="p-2 hidden md:table-cell">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              r.isValid
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : r.isDisposable
                                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                : 'bg-red-500/10 text-red-400 border border-red-500/30'
                            }`}>
                              {r.isValid ? 'Valid' : r.isDisposable ? 'Burner' : 'Invalid'}
                            </span>
                          </td>
                          <td className="p-2 text-xs text-foreground-secondary truncate max-w-[150px] hidden lg:table-cell">
                            {r.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredResults.length === 0 && (
                <div className="text-center py-6 border border-dashed border-white/10 rounded-lg">
                  <p className="text-foreground-secondary text-sm">No results match the current filter.</p>
                </div>
              )}
            </div>
          )}

          {/* Bulk empty state */}
          {!batchResults && !loading && !error && (
            <div className="text-center py-8 border border-dashed border-white/10 rounded-lg">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-foreground-secondary text-sm">Upload a CSV or paste emails above to validate them all at once</p>
              <p className="text-foreground-secondary text-xs mt-1">Up to 100 emails per batch — perfect for list cleaning</p>
            </div>
          )}
        </>
      )}

      {/* Shared Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mt-4">
          {error}
        </div>
      )}
    </div>
  );
}