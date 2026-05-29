'use client';

import { useState, useEffect } from 'react';

interface BomberResult {
  ok: boolean;
  summary?: {
    total: number;
    sent: number;
    failed: number;
    durationMs: number;
    avgPerEmail: number;
    batches: number;
    batchSize: number;
    ratePerMinute: number;
  };
  errors?: string[];
  error?: string;
}

interface SendHistoryItem {
  id: string;
  timestamp: string;
  total: number;
  sent: number;
  failed: number;
  durationMs: number;
}

const STORAGE_HISTORY_KEY = 'bomber_history';

export function EmailBomberCard() {
  const [recipientsText, setRecipientsText] = useState('');

  // State
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BomberResult | null>(null);
  const [error, setError] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [liveSent, setLiveSent] = useState(0);
  const [liveFailed, setLiveFailed] = useState(0);
  const [abort, setAbort] = useState<AbortController | null>(null);

  // Send history
  const [history, setHistory] = useState<SendHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load saved data on mount
  useEffect(() => {
    try {
      const h = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (h) setHistory(JSON.parse(h));
    } catch {}
  }, []);

  const saveHistory = (h: SendHistoryItem[]) => {
    setHistory(h);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(h));
  };

  // Parse recipients
  const parseRecipients = () => {
    const lines = recipientsText.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      const email = parts[0]?.toLowerCase().trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
      return { email, firstName: parts[1] || '', lastName: parts[2] || '' };
    }).filter(Boolean) as Array<{ email: string; firstName: string; lastName: string }>;
  };

  // CSV file upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      const first = lines[0].toLowerCase();
      const hasHeader = first.includes('email') || first.includes('name') || first.includes('first');
      const dataLines = hasHeader ? lines.slice(1) : lines;
      const existing = recipientsText.trim() ? recipientsText.trim() + '\n' : '';
      setRecipientsText(existing + dataLines.join('\n'));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Send
  const handleSend = async () => {
    setError('');
    setResult(null);
    setProgressPct(0);
    setLiveSent(0);
    setLiveFailed(0);

    const recipients = parseRecipients();
    if (recipients.length === 0) {
      setError('No valid email recipients found. Add one email per line.');
      return;
    }
    // Check wallet balance ($0.5 per bomb)
    const usdBalance = parseFloat(localStorage.getItem('wallet_usd_balance') || '0');
    const bombCost = 0.5;
    if (usdBalance < bombCost) {
      setError(`⚠️ Insufficient balance. Each bomb costs $${bombCost.toFixed(2)}. Your wallet has $${usdBalance.toFixed(2)}.`);
      window.dispatchEvent(new CustomEvent('redirect-to-deposit', {
        detail: { required: bombCost, balance: usdBalance, source: 'email-bomber' }
      }));
      return;
    }

    const count = recipients.length;
    if (!confirm(`Send ${count} email(s)? This will cost $${bombCost.toFixed(2)}.`)) return;

    setSending(true);
    const controller = new AbortController();
    setAbort(controller);

    const progressInterval = setInterval(() => {
      setProgressPct((p) => Math.min(95, p + Math.random() * 5));
    }, 800);

    try {
      const res = await fetch('/api/mailer/bomber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
        }),
        signal: controller.signal,
      });

      clearInterval(progressInterval);
      setProgressPct(100);
      const data: BomberResult = await res.json();
      setResult(data);

      if (data.summary) {
        setLiveSent(data.summary.sent);
        setLiveFailed(data.summary.failed);
      }

      if (!data.ok) {
        setError(data.error || 'Send failed');
      } else if (data.summary) {
        const entry: SendHistoryItem = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          total: data.summary.total,
          sent: data.summary.sent,
          failed: data.summary.failed,
          durationMs: data.summary.durationMs,
        };
        saveHistory([entry, ...history].slice(0, 50));
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      if (err.name === 'AbortError') {
        setError('Send cancelled');
        setProgressPct(0);
      } else {
        setError(err.message || 'Failed to send');
      }
    } finally {
      setSending(false);
      setAbort(null);
    }
  };

  const handleCancel = () => {
    if (abort) { abort.abort(); setAbort(null); }
  };

  const clearHistory = () => saveHistory([]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xl">💣</span>
          <h3 className="text-lg font-serif text-white">Email Bomber</h3>
          <span className="text-[8px] uppercase tracking-widest bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 text-red-400">
            Power Tool
          </span>

          {/* Action buttons */}
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setShowHistory(!showHistory)}
              className="px-2.5 py-1 rounded text-[10px] font-medium border border-white/10 text-foreground-secondary hover:text-white hover:bg-white/5">
              📜 History ({history.length})
            </button>
          </div>
        </div>
        <p className="text-sm text-foreground-secondary mb-3">
          Send bulk emails to your target list. Just add recipients and launch.
        </p>
        <div className="mb-5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400 flex items-center gap-2">
          💰 <strong>Pricing:</strong> $0.50 per bomb
        </div>

        {/* ─── History Panel ──────────────────────────────────────── */}
        {showHistory && (
          <div className="mb-6 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-white">📜 Send History</h4>
              {history.length > 0 && (
                <button onClick={clearHistory} className="text-[10px] text-red-400 hover:underline">Clear all</button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-foreground-secondary">No sends yet.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-2 rounded bg-white/[0.02] text-[10px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-foreground-secondary shrink-0">{formatTime(h.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-emerald-400">{h.sent}/{h.total}</span>
                      {h.failed > 0 && <span className="text-red-400">{h.failed}f</span>}
                      <span className="text-foreground-secondary">{formatDuration(h.durationMs)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left: Recipients */}
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h4 className="text-sm font-medium text-white">👥 Recipients</h4>
                <div className="flex items-center gap-2">
                  {recipientsText.trim() && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium border border-white/10 text-emerald-400">
                      ✅ {parseRecipients().length} valid
                    </span>
                  )}
                  <label className="px-2 py-0.5 rounded text-[10px] font-medium border border-white/10 text-foreground-secondary hover:text-white hover:bg-white/5 cursor-pointer">
                    📂 CSV
                    <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
              <textarea value={recipientsText} onChange={(e) => { setRecipientsText(e.target.value); }}
                placeholder="email@example.com, FirstName, LastName&#10;or just one per line"
                rows={8}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white text-xs placeholder:text-foreground-secondary/50 focus:border-accent-gold focus:outline-none resize-none font-mono" />
              <p className="text-[10px] text-foreground-secondary mt-1">
                One per line. Format: <code className="text-accent-gold">email, firstName, lastName</code>
              </p>
            </div>
          </div>

        </div>

        {/* Live Progress Bar */}
        {sending && (
          <div className="mt-6 p-4 rounded-lg bg-accent-gold/5 border border-accent-gold/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white font-medium">
                🔴 Sending... {liveSent + liveFailed} / {parseRecipients().length}
              </span>
              <span className="text-[10px] text-foreground-secondary">
                ✓ {liveSent} {liveFailed > 0 ? `✗ ${liveFailed}` : ''}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-accent-gold to-accent-neon-blue transition-all duration-300"
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>
        )}

        {/* Result */}
        {result?.ok && result.summary && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <h4 className="text-sm font-medium text-emerald-400 mb-3">✅ Send Complete</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                <p className="text-lg font-bold text-white">{result.summary.total}</p>
                <p className="text-[10px] text-foreground-secondary">Total</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                <p className="text-lg font-bold text-emerald-400">{result.summary.sent}</p>
                <p className="text-[10px] text-foreground-secondary">Sent</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                <p className={`text-lg font-bold ${result.summary.failed > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{result.summary.failed}</p>
                <p className="text-[10px] text-foreground-secondary">Failed</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                <p className="text-lg font-bold text-accent-gold">{formatDuration(result.summary.durationMs)}</p>
                <p className="text-[10px] text-foreground-secondary">Duration</p>
              </div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <p className="text-xs text-red-400 mb-2">Errors ({result.errors.length}):</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <p key={i} className="text-[10px] text-red-300 font-mono">{err}</p>
                  ))}
                  {result.errors.length > 10 && <p className="text-[10px] text-foreground-secondary">...and {result.errors.length - 10} more</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button onClick={handleSend} disabled={sending}
            className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white font-bold hover:shadow-lg hover:shadow-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
            {sending ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending... {liveSent + liveFailed}/{parseRecipients().length}</>
            ) : (
              <>💣 Launch Bomb ({parseRecipients().length} targets)</>
            )}
          </button>
          {sending && (
            <button onClick={handleCancel}
              className="px-6 py-3 rounded-lg bg-white/10 border border-white/20 text-white font-medium hover:bg-white/15 transition-all">✋ Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}