'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import type {
  TloLookupResponse,
  TloPermissibleUseCode,
  TloAnomaly,
} from '@/types/tloxp';
import { PERMISSIBLE_USE_OPTIONS } from '@/types/tloxp';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LookupMode = 'identity' | 'phone' | 'background';

interface IdentityForm {
  firstName: string;
  lastName: string;
  ssn: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface PhoneForm {
  phone: string;
  firstName: string;
  lastName: string;
}

interface BackgroundForm {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  ssn: string;
}

type AnyForm = IdentityForm | PhoneForm | BackgroundForm;

type FormErrors = Partial<Record<string, string>>;

interface HistoryEntry {
  id: string;
  timestamp: number;
  name: string;
  mode: LookupMode;
  matchScore: number;
  verified: boolean;
  tier?: string;
  anomaliesCount: number;
  identityToken: string;
  usedCode: TloPermissibleUseCode;
}

interface RateLimitInfo {
  remaining: number;
  resetIn: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSsn(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function maskSsn(value: string): string {
  const raw = value.replace(/\D/g, '');
  if (raw.length < 4) return '•••-••-••••';
  return `•••-••-${raw.slice(-4)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function parseDob(input: string): { valid: boolean; formatted: string; error?: string } {
  const cleaned = input.replace(/\D/g, '').slice(0, 8);
  if (cleaned.length !== 8) {
    return { valid: false, formatted: '', error: 'Date must be exactly 8 digits (MMDDYYYY).' };
  }
  const m = parseInt(cleaned.slice(0, 2), 10);
  const d = parseInt(cleaned.slice(2, 4), 10);
  const y = parseInt(cleaned.slice(4), 10);

  if (m < 1 || m > 12) return { valid: false, formatted: '', error: 'Month must be 01–12.' };
  if (d < 1 || d > 31) return { valid: false, formatted: '', error: 'Day must be 01–31.' };

  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return { valid: false, formatted: '', error: 'Invalid date.' };
  }
  if (date > new Date()) return { valid: false, formatted: '', error: 'Date of birth cannot be in the future.' };

  return { valid: true, formatted: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}

function tierColor(tier?: string): string {
  switch (tier) {
    case 'A': return 'text-emerald-400';
    case 'B': return 'text-emerald-300';
    case 'C': return 'text-amber-400';
    case 'D': return 'text-orange-400';
    case 'E': return 'text-red-400';
    default: return 'text-foreground-secondary';
  }
}

function tierBg(tier?: string): string {
  switch (tier) {
    case 'A': return 'bg-emerald-500/10 border-emerald-500/30';
    case 'B': return 'bg-emerald-500/5 border-emerald-500/20';
    case 'C': return 'bg-amber-500/10 border-amber-500/30';
    case 'D': return 'bg-orange-500/10 border-orange-500/30';
    case 'E': return 'bg-red-500/10 border-red-500/30';
    default: return 'bg-white/5 border-white/10';
  }
}

function severityColor(severity: TloAnomaly['severity']): string {
  switch (severity) {
    case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
    case 'medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'low': return 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30';
  }
}

function severityIcon(severity: TloAnomaly['severity']): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
  }
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-center mb-6">
        <div className="w-28 h-28 rounded-full bg-white/10" />
      </div>
      <div className="h-4 bg-white/10 rounded w-2/3 mx-auto" />
      <div className="h-3 bg-white/10 rounded w-1/3 mx-auto" />
      <div className="grid grid-cols-2 gap-3 mt-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 bg-white/10 rounded-lg" />
        ))}
      </div>
      <div className="flex justify-center gap-2 mt-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-6 w-20 bg-white/10 rounded-full" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match Score Gauge
// ---------------------------------------------------------------------------

function MatchScoreGauge({ score, tier, animate = true }: { score: number; tier?: string; animate?: boolean }) {
  const color =
    score >= 85 ? '#10b981' : score >= 70 ? '#f59e0b' : score >= 55 ? '#f97316' : '#ef4444';
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
          <defs>
            <filter id="gauge-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={animate ? offset : circumference}
            filter="url(#gauge-glow)"
            className={animate ? 'transition-all duration-1000 ease-out' : ''}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white">{score}</span>
          <span className="text-[10px] text-foreground-secondary uppercase tracking-wider">Match</span>
        </div>
      </div>
      {tier && (
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${tierBg(tier)} ${tierColor(tier)}`}>
            Tier {tier}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permissible Use Badge
// ---------------------------------------------------------------------------

function PermissibleUseBadge({ code }: { code: TloPermissibleUseCode }) {
  const option = PERMISSIBLE_USE_OPTIONS.find((o) => o.code === code);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-foreground-secondary font-mono">
      {option?.label || code}
    </span>
  );
}

// ---------------------------------------------------------------------------
// History Item
// ---------------------------------------------------------------------------

function HistoryItem({ entry, onClick }: { entry: HistoryEntry; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] cursor-pointer transition-all group"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        entry.verified ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
      }`}>
        {entry.matchScore}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium truncate">{entry.name}</span>
          <span className="text-[9px] uppercase tracking-wider text-foreground-secondary">
            {entry.mode === 'identity' ? 'SSN' : entry.mode === 'phone' ? 'PHONE' : 'BG'}
          </span>
          {entry.tier && <span className={`text-[10px] font-bold ${tierColor(entry.tier)}`}>{entry.tier}</span>}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-foreground-secondary">
          <span>{formatTimestamp(entry.timestamp)}</span>
          {entry.anomaliesCount > 0 && <span className="text-red-400">{entry.anomaliesCount} flag{entry.anomaliesCount > 1 ? 's' : ''}</span>}
          <PermissibleUseBadge code={entry.usedCode} />
        </div>
      </div>
      <span className="text-foreground-secondary text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function TLOverificationCard() {
  const { user } = useAuth();
  const resultsRef = useRef<HTMLDivElement>(null);

  // Mode
  const [mode, setMode] = useState<LookupMode>('identity');

  // Form state
  const [identityForm, setIdentityForm] = useState<IdentityForm>({
    firstName: '', lastName: '', ssn: '', dob: '', address: '', city: '', state: '', zip: '',
  });
  const [phoneForm, setPhoneForm] = useState<PhoneForm>({ phone: '', firstName: '', lastName: '' });
  const [backgroundForm, setBackgroundForm] = useState<BackgroundForm>({
    firstName: '', lastName: '', address: '', city: '', state: '', zip: '', phone: '', ssn: '',
  });
  const [permissibleUseCode, setPermissibleUseCode] = useState<TloPermissibleUseCode | ''>('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState(0);

  // Result state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TloLookupResponse | null>(null);
  const [error, setError] = useState('');
  const [usedCode, setUsedCode] = useState<TloPermissibleUseCode | ''>('');
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryEntry | null>(null);

  // Step animation
  useEffect(() => {
    if (!loading) { setCurrentStep(0); return; }
    const interval = setInterval(() => setCurrentStep((p) => Math.min(p + 1, 4)), 800);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (result && resultsRef.current) resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [result]);

  // -----------------------------------------------------------------------
  // Form helpers
  // -----------------------------------------------------------------------
  const handleIdentityChange = useCallback((field: keyof IdentityForm, value: string) => {
    setIdentityForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  }, [formErrors]);

  const handlePhoneChange = useCallback((field: keyof PhoneForm, value: string) => {
    setPhoneForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  }, [formErrors]);

  const handleBackgroundChange = useCallback((field: keyof BackgroundForm, value: string) => {
    setBackgroundForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  }, [formErrors]);

  const handleBlur = useCallback((field: string) => setTouched((prev) => new Set(prev).add(field)), []);

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------
  const validate = useCallback((): boolean => {
    const errors: FormErrors = {};

    if (mode === 'identity') {
      if (!identityForm.firstName.trim()) errors.firstName = 'First name is required';
      if (!identityForm.lastName.trim()) errors.lastName = 'Last name is required';
      const ssnDigits = identityForm.ssn.replace(/\D/g, '');
      if (ssnDigits.length !== 9) errors.ssn = 'SSN must be 9 digits';
      const dobR = parseDob(identityForm.dob);
      if (!dobR.valid) errors.dob = dobR.error;
    } else if (mode === 'phone') {
      if (phoneForm.phone.replace(/\D/g, '').length < 10) errors.phone = 'Phone must be at least 10 digits';
    } else if (mode === 'background') {
      if (!backgroundForm.firstName.trim()) errors.firstName = 'First name is required';
      if (!backgroundForm.lastName.trim()) errors.lastName = 'Last name is required';
    }

    if (!permissibleUseCode) errors.permissibleUse = 'Select a permissible use reason';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [mode, identityForm, phoneForm, backgroundForm, permissibleUseCode]);

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    if (!user?.id) { setError('You must be logged in.'); return; }

    setLoading(true); setError(''); setResult(null); setRateLimit(null); setSelectedHistory(null);

    try {
      let body: Record<string, unknown> = { permissibleUseCode };

      if (mode === 'identity') {
        const dobR = parseDob(identityForm.dob);
        if (!dobR.valid) { setError(dobR.error!); setLoading(false); return; }
        body = {
          ...body,
          firstName: identityForm.firstName.trim(),
          lastName: identityForm.lastName.trim(),
          ssn: identityForm.ssn.replace(/\D/g, ''),
          dob: dobR.formatted,
          address: identityForm.address.trim() || undefined,
          city: identityForm.city.trim() || undefined,
          state: identityForm.state.trim().toUpperCase().slice(0, 2) || undefined,
          zip: identityForm.zip.trim().slice(0, 10) || undefined,
        };
      } else if (mode === 'phone') {
        body = {
          ...body,
          phone: phoneForm.phone.replace(/\D/g, '').slice(0, 10),
          firstName: phoneForm.firstName.trim() || undefined,
          lastName: phoneForm.lastName.trim() || undefined,
        };
      } else if (mode === 'background') {
        body = {
          ...body,
          firstName: backgroundForm.firstName.trim(),
          lastName: backgroundForm.lastName.trim(),
          address: backgroundForm.address.trim() || undefined,
          city: backgroundForm.city.trim() || undefined,
          state: backgroundForm.state.trim().toUpperCase().slice(0, 2) || undefined,
          zip: backgroundForm.zip.trim().slice(0, 10) || undefined,
          phone: backgroundForm.phone.replace(/\D/g, '').slice(0, 10) || undefined,
          ssn: backgroundForm.ssn.replace(/\D/g, '') || undefined,
        };
      }

      const res = await fetch(`/api/v1/verify/tlo?mode=${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-id': user.id, 'x-permissible-use': permissibleUseCode! },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.rateLimit) setRateLimit({ remaining: data.rateLimit.remaining, resetIn: data.rateLimit.resetIn });

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        if (data.usedCode) setUsedCode(data.usedCode);
        return;
      }

      setResult(data.data);
      setUsedCode(data.usedCode || permissibleUseCode);

      const name = mode === 'identity'
        ? `${identityForm.firstName.trim()} ${identityForm.lastName.trim()}`
        : mode === 'phone'
          ? formatPhone(phoneForm.phone)
          : `${backgroundForm.firstName.trim()} ${backgroundForm.lastName.trim()}`;

      setHistory((prev) => [{
        id: Date.now().toString(),
        timestamp: Date.now(),
        name,
        mode,
        matchScore: data.data.matchScore,
        verified: data.data.verified,
        tier: data.data.tier,
        anomaliesCount: data.data.anomalies?.length ?? 0,
        identityToken: data.data.identityToken,
        usedCode: data.usedCode || permissibleUseCode,
      }, ...prev].slice(0, 20));

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally { setLoading(false); }
  }, [mode, identityForm, phoneForm, backgroundForm, permissibleUseCode, user?.id, validate]);

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------
  const handleReset = useCallback(() => {
    setIdentityForm({ firstName: '', lastName: '', ssn: '', dob: '', address: '', city: '', state: '', zip: '' });
    setPhoneForm({ phone: '', firstName: '', lastName: '' });
    setBackgroundForm({ firstName: '', lastName: '', address: '', city: '', state: '', zip: '', phone: '', ssn: '' });
    setPermissibleUseCode(''); setFormErrors({}); setTouched(new Set());
    setResult(null); setError(''); setUsedCode(''); setRateLimit(null); setSelectedHistory(null);
  }, []);

  const handleHistoryClick = useCallback((entry: HistoryEntry) => {
    setSelectedHistory(entry);
    setResult({
      matchScore: entry.matchScore,
      identityToken: entry.identityToken,
      verified: entry.verified,
      anomalies: [],
      deceasedIndicator: false,
      tier: entry.tier as any,
    });
    setUsedCode(entry.usedCode);
    setShowHistory(false);
  }, []);

  // -----------------------------------------------------------------------
  // Disabled check
  // -----------------------------------------------------------------------
  const isSubmitDisabled = (() => {
    if (loading || !permissibleUseCode) return true;
    if (mode === 'identity') return !identityForm.firstName.trim() || !identityForm.lastName.trim() || identityForm.ssn.replace(/\D/g, '').length !== 9 || !identityForm.dob;
    if (mode === 'phone') return phoneForm.phone.replace(/\D/g, '').length < 10;
    if (mode === 'background') return !backgroundForm.firstName.trim() || !backgroundForm.lastName.trim();
    return true;
  })();

  const LoaderSteps = [
    { label: 'Submitting request', sub: 'Encrypting and transmitting to bureau' },
    { label: 'Querying bureau database', sub: 'Searching identity records & databases' },
    { label: 'Analyzing match factors', sub: 'Evaluating identity markers & risk signals' },
    { label: 'Compiling report', sub: 'Assessing indicators across data sources' },
    { label: 'Finalizing results', sub: 'Preparing secure response' },
  ];

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="relative group" ref={resultsRef}>
      <div className="relative overflow-hidden backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl shadow-glass-lg transition-all duration-500 group-hover:border-white/[0.15] group-hover:shadow-gold-glow-lg">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-accent-gold/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-accent-neon-blue/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-6 z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-serif text-white flex items-center gap-2">
                <span className="text-accent-gold">🛡️</span> Identity & Background
              </h3>
              <p className="text-foreground-secondary text-sm mt-1">
                TransUnion TLOxp — SSN lookup, phone trace, or full background
              </p>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && !loading && (
                <button onClick={() => setShowHistory(!showHistory)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${showHistory ? 'bg-accent-gold/10 border-accent-gold/40 text-accent-gold' : 'text-foreground-secondary border-white/10 hover:text-white hover:border-white/30'}`}>
                  📋 {history.length}
                </button>
              )}
              {(result || selectedHistory) && (
                <button onClick={handleReset} className="text-xs text-foreground-secondary hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30">New Search</button>
              )}
            </div>
          </div>

          {/* Mode Toggle */}
          {!result && !selectedHistory && !loading && (
            <div className="flex gap-1.5 mb-4 bg-white/5 rounded-lg p-1 w-fit">
              {(['identity', 'phone', 'background'] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setFormErrors({}); setTouched(new Set()); setError(''); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                    mode === m ? 'bg-accent-gold text-black shadow-lg shadow-accent-gold/30' : 'text-foreground-secondary hover:text-white'
                  }`}>
                  {m === 'identity' ? '🔐 SSN' : m === 'phone' ? '📱 Phone' : '📋 Background'}
                </button>
              ))}
            </div>
          )}

          {/* History Panel */}
          {showHistory && history.length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] max-h-48 overflow-y-auto space-y-1.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-foreground-secondary uppercase tracking-wider font-medium">Recent Lookups</span>
                <button onClick={() => setShowHistory(false)} className="text-[10px] text-foreground-secondary hover:text-white">Close</button>
              </div>
              {history.map((entry) => (
                <HistoryItem key={entry.id} entry={entry} onClick={() => handleHistoryClick(entry)} />
              ))}
            </div>
          )}

          {/* Permissible Use */}
          <div className={`mb-4 p-4 rounded-xl ${result || selectedHistory ? 'bg-white/[0.02] border border-white/[0.06]' : 'bg-accent-gold/[0.03] border border-accent-gold/[0.12]'}`}>
            <label className="block text-xs font-medium text-foreground-secondary uppercase tracking-wider mb-2">
              Permissible Use Reason <span className="text-red-400">*</span>
            </label>
            {result || selectedHistory ? (
              <div className="flex items-center gap-2 py-1">
                <PermissibleUseBadge code={(usedCode || permissibleUseCode) as TloPermissibleUseCode} />
                <span className="text-[11px] text-foreground-secondary">
                  {PERMISSIBLE_USE_OPTIONS.find((o) => o.code === (usedCode || permissibleUseCode))?.description}
                </span>
              </div>
            ) : (
              <>
                <select value={permissibleUseCode} onChange={(e) => { setPermissibleUseCode(e.target.value as TloPermissibleUseCode); setFormErrors((p) => { const n = { ...p }; delete n.permissibleUse; return n; }); }}
                  onBlur={() => setTouched((p) => new Set(p).add('permissibleUse'))} disabled={loading}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-accent-gold/60 focus:ring-1 focus:ring-accent-gold/30 transition-all text-sm appearance-none cursor-pointer disabled:opacity-40">
                  <option value="" className="bg-background-secondary">— Select reason for lookup —</option>
                  {PERMISSIBLE_USE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code} className="bg-background-secondary py-1">{opt.label}</option>
                  ))}
                </select>
                {permissibleUseCode && <p className="text-[11px] text-foreground-secondary mt-1.5 italic">{PERMISSIBLE_USE_OPTIONS.find((o) => o.code === permissibleUseCode)?.description}</p>}
                {!permissibleUseCode && !loading && <p className="text-[11px] text-amber-400/70 mt-1.5 flex items-center gap-1"><span>🔒</span> Submit is locked until a permissible use reason is selected</p>}
              </>
            )}
          </div>

          {/* Results View */}
          {(result || selectedHistory) ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center py-4">
                <MatchScoreGauge score={result!.matchScore} tier={result!.tier} animate={!selectedHistory} />
                <div className={`mt-4 px-5 py-2 rounded-full text-sm font-bold flex items-center gap-2 ${
                  result!.verified ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : result!.deceasedIndicator ? 'bg-gray-500/15 text-gray-400 border border-gray-500/30'
                    : 'bg-red-500/15 text-red-400 border border-red-500/30'
                }`}>
                  {result!.verified ? '✅ Identity Verified' : result!.deceasedIndicator ? '⚰️ Deceased Indicator' : '❌ Identity Not Verified'}
                </div>
                {result!.age !== undefined && <p className="text-foreground-secondary text-xs mt-2">Age: {result!.age} years</p>}
              </div>

              {result!.identityToken && (
                <div className="flex items-center justify-center">
                  <span className="text-[10px] text-foreground-secondary font-mono bg-white/[0.03] px-3 py-1 rounded-full border border-white/[0.06]">🆔 {result!.identityToken}</span>
                </div>
              )}

              <div className={`p-3 rounded-lg border text-xs ${
                result!.matchScore >= 70 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                  : result!.matchScore >= 50 ? 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                  : 'bg-red-500/5 border-red-500/20 text-red-300'
              }`}>
                <p>{result!.matchScore >= 90 ? 'Strong identity match. All provided data points align with bureau records.'
                  : result!.matchScore >= 75 ? 'Moderate identity match. Minor discrepancies detected.'
                  : result!.matchScore >= 55 ? 'Weak identity match. Significant discrepancies found — manual verification recommended.'
                  : 'Failed identity match. Critical discrepancies detected — do not proceed without additional verification.'}</p>
              </div>

              {result!.anomalies.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-1.5">
                    <span>🚩</span> Anomalies & Flags <span className="text-xs text-foreground-secondary font-normal">({result!.anomalies.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {result!.anomalies.map((anomaly, idx) => (
                      <div key={`${anomaly.type}-${idx}`} className={`p-3 rounded-lg border text-xs ${severityColor(anomaly.severity)}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span>{severityIcon(anomaly.severity)}</span>
                            <span className="font-semibold uppercase tracking-wider text-[11px]">{anomaly.type.replace(/_/g, ' ')}</span>
                          </div>
                          <span className={`capitalize text-[10px] px-1.5 py-0.5 rounded-full ${
                            anomaly.severity === 'critical' ? 'bg-red-500/20' : anomaly.severity === 'high' ? 'bg-orange-500/20' : anomaly.severity === 'medium' ? 'bg-amber-500/20' : 'bg-yellow-500/20'
                          }`}>{anomaly.severity}</span>
                        </div>
                        <p className="opacity-80 leading-relaxed">{anomaly.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result!.anomalies.length === 0 && (
                <div className="text-center py-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-emerald-400 text-sm">✅ No anomalies detected — clean match</p>
                </div>
              )}

              <div className="pt-3 border-t border-white/10 space-y-1">
                {usedCode && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-foreground-secondary">Lookup authority</span>
                    <PermissibleUseBadge code={usedCode as TloPermissibleUseCode} />
                  </div>
                )}
                {rateLimit && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-foreground-secondary">Rate limit</span>
                    <span className={`font-mono ${rateLimit.remaining < 3 ? 'text-red-400' : 'text-foreground-secondary'}`}>{rateLimit.remaining} remaining</span>
                  </div>
                )}
              </div>
            </div>
          ) : loading ? (
            <div className="py-8">
              <div className="flex justify-center mb-8">
                <div className="relative w-28 h-28">
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-accent-gold border-r-accent-neon-blue animate-spin" />
                  <div className="absolute inset-3 rounded-full border-2 border-accent-gold/30 animate-pulse" />
                  <div className="absolute inset-6 rounded-full bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/20" />
                  <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl">🛡️</span></div>
                </div>
              </div>
              <div className="space-y-3 max-w-sm mx-auto">
                {LoaderSteps.map((step, idx) => (
                  <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-500 ${
                    currentStep >= idx ? 'bg-white/5 border-white/10 opacity-100' : 'opacity-20'
                  } ${currentStep === idx ? 'border-accent-gold/40 bg-accent-gold/5 animate-pulse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 transition-all ${
                      currentStep > idx ? 'bg-emerald-500/20 text-emerald-400' : currentStep === idx ? 'bg-accent-gold/20 text-accent-gold' : 'bg-white/10 text-foreground-secondary'
                    }`}>{currentStep > idx ? '✓' : idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${currentStep === idx ? 'text-white' : 'text-foreground-secondary'}`}>{step.label}</p>
                      <p className="text-[10px] text-foreground-secondary">{step.sub}</p>
                    </div>
                    {currentStep === idx && <span className="inline-block w-2 h-2 rounded-full bg-accent-gold animate-pulse" />}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* === IDENTITY MODE (SSN) === */}
              {mode === 'identity' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-foreground-secondary mb-1 font-medium">Legal First Name <span className="text-red-400">*</span></label>
                    <input type="text" placeholder="John" value={identityForm.firstName}
                      onChange={(e) => handleIdentityChange('firstName', e.target.value)} onBlur={() => handleBlur('firstName')}
                      disabled={loading} autoComplete="given-name"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm disabled:opacity-40" />
                    {touched.has('firstName') && formErrors.firstName && <p className="text-red-400 text-xs mt-0.5">{formErrors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-foreground-secondary mb-1 font-medium">Legal Last Name <span className="text-red-400">*</span></label>
                    <input type="text" placeholder="Doe" value={identityForm.lastName}
                      onChange={(e) => handleIdentityChange('lastName', e.target.value)} onBlur={() => handleBlur('lastName')}
                      disabled={loading} autoComplete="family-name"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm disabled:opacity-40" />
                    {touched.has('lastName') && formErrors.lastName && <p className="text-red-400 text-xs mt-0.5">{formErrors.lastName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-foreground-secondary mb-1 font-medium">SSN <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <input type="text" inputMode="numeric" placeholder="XXX-XX-XXXX"
                        value={loading ? maskSsn(identityForm.ssn) : formatSsn(identityForm.ssn)}
                        onChange={(e) => handleIdentityChange('ssn', e.target.value.replace(/\D/g, '').slice(0, 9))}
                        onBlur={() => handleBlur('ssn')} disabled={loading} autoComplete="off"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm font-mono tracking-wider disabled:opacity-40" />
                      {identityForm.ssn.replace(/\D/g, '').length === 9 && !loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400">✓</span>}
                    </div>
                    {touched.has('ssn') && formErrors.ssn && <p className="text-red-400 text-xs mt-0.5">{formErrors.ssn}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-foreground-secondary mb-1 font-medium">Date of Birth <span className="text-red-400">*</span></label>
                    <input type="text" inputMode="numeric" placeholder="MMDDYYYY" value={identityForm.dob}
                      onChange={(e) => handleIdentityChange('dob', e.target.value.replace(/\D/g, '').slice(0, 8))}
                      onBlur={() => handleBlur('dob')} disabled={loading} autoComplete="bday"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm font-mono disabled:opacity-40" />
                    {touched.has('dob') && formErrors.dob && <p className="text-red-400 text-xs mt-0.5">{formErrors.dob}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-foreground-secondary mb-1 font-medium">Current Address <span className="text-foreground-secondary/50">(optional — improves accuracy)</span></label>
                    <input type="text" placeholder="123 Main St, Apt 4B" value={identityForm.address}
                      onChange={(e) => handleIdentityChange('address', e.target.value)} disabled={loading} autoComplete="street-address"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm disabled:opacity-40" />
                  </div>
                  <div>
                    <label className="block text-xs text-foreground-secondary mb-1 font-medium">City <span className="text-foreground-secondary/50">(opt.)</span></label>
                    <input type="text" placeholder="New York" value={identityForm.city}
                      onChange={(e) => handleIdentityChange('city', e.target.value)} disabled={loading} autoComplete="address-level2"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm disabled:opacity-40" />
                  </div>
                  <div>
                    <label className="block text-xs text-foreground-secondary mb-1 font-medium">State <span className="text-foreground-secondary/50">(opt.)</span></label>
                    <input type="text" placeholder="NY" maxLength={2} value={identityForm.state}
                      onChange={(e) => handleIdentityChange('state', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))} disabled={loading} autoComplete="address-level1"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm font-mono disabled:opacity-40" />
                  </div>
                  <div>
                    <label className="block text-xs text-foreground-secondary mb-1 font-medium">ZIP <span className="text-foreground-secondary/50">(opt.)</span></label>
                    <input type="text" inputMode="numeric" placeholder="10001" maxLength={5} value={identityForm.zip}
                      onChange={(e) => handleIdentityChange('zip', e.target.value.replace(/\D/g, '').slice(0, 5))} disabled={loading} autoComplete="postal-code"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm font-mono disabled:opacity-40" />
                  </div>
                </div>
              )}

              {/* === PHONE MODE === */}
              {mode === 'phone' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-foreground-secondary mb-1 font-medium">Phone Number <span className="text-red-400">*</span></label>
                    <input type="tel" inputMode="tel" placeholder="(555) 123-4567" value={formatPhone(phoneForm.phone)}
                      onChange={(e) => handlePhoneChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onBlur={() => handleBlur('phone')} disabled={loading} autoComplete="tel"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm font-mono tracking-wider disabled:opacity-40" />
                    {touched.has('phone') && formErrors.phone && <p className="text-red-400 text-xs mt-0.5">{formErrors.phone}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-foreground-secondary mb-1 font-medium">First Name <span className="text-foreground-secondary/50">(opt.)</span></label>
                      <input type="text" placeholder="John" value={phoneForm.firstName}
                        onChange={(e) => handlePhoneChange('firstName', e.target.value)} disabled={loading}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm disabled:opacity-40" />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground-secondary mb-1 font-medium">Last Name <span className="text-foreground-secondary/50">(opt.)</span></label>
                      <input type="text" placeholder="Doe" value={phoneForm.lastName}
                        onChange={(e) => handlePhoneChange('lastName', e.target.value)} disabled={loading}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm disabled:opacity-40" />
                    </div>
                  </div>
                  <p className="text-[10px] text-foreground-secondary">Look up identity information associated with a phone number. Adding a name improves match accuracy.</p>
                </div>
              )}

              {/* === BACKGROUND MODE === */}
              {mode === 'background' && (
                <div className="space-y-3">
                  <p className="text-[10px] text-foreground-secondary mb-2">Run a comprehensive background search using available identity data. Provide as much as possible for best results.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-foreground-secondary mb-1 font-medium">First Name <span className="text-red-400">*</span></label>
                      <input type="text" placeholder="John" value={backgroundForm.firstName}
                        onChange={(e) => handleBackgroundChange('firstName', e.target.value)} onBlur={() => handleBlur('firstName')} disabled={loading}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm disabled:opacity-40" />
                      {touched.has('firstName') && formErrors.firstName && <p className="text-red-400 text-xs mt-0.5">{formErrors.firstName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-foreground-secondary mb-1 font-medium">Last Name <span className="text-red-400">*</span></label>
                      <input type="text" placeholder="Doe" value={backgroundForm.lastName}
                        onChange={(e) => handleBackgroundChange('lastName', e.target.value)} onBlur={() => handleBlur('lastName')} disabled={loading}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm disabled:opacity-40" />
                      {touched.has('lastName') && formErrors.lastName && <p className="text-red-400 text-xs mt-0.5">{formErrors.lastName}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-foreground-secondary mb-1 font-medium">Address <span className="text-foreground-secondary/50">(optional)</span></label>
                      <input type="text" placeholder="123 Main St" value={backgroundForm.address}
                        onChange={(e) => handleBackgroundChange('address', e.target.value)} disabled={loading}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm disabled:opacity-40" />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground-secondary mb-1 font-medium">City <span className="text-foreground-secondary/50">(opt.)</span></label>
                      <input type="text" placeholder="New York" value={backgroundForm.city}
                        onChange={(e) => handleBackgroundChange('city', e.target.value)} disabled={loading}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm disabled:opacity-40" />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground-secondary mb-1 font-medium">State <span className="text-foreground-secondary/50">(opt.)</span></label>
                      <input type="text" placeholder="NY" maxLength={2} value={backgroundForm.state}
                        onChange={(e) => handleBackgroundChange('state', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))} disabled={loading}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm font-mono disabled:opacity-40" />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground-secondary mb-1 font-medium">ZIP <span className="text-foreground-secondary/50">(opt.)</span></label>
                      <input type="text" inputMode="numeric" placeholder="10001" maxLength={5} value={backgroundForm.zip}
                        onChange={(e) => handleBackgroundChange('zip', e.target.value.replace(/\D/g, '').slice(0, 5))} disabled={loading}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm font-mono disabled:opacity-40" />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground-secondary mb-1 font-medium">Phone <span className="text-foreground-secondary/50">(opt.)</span></label>
                      <input type="tel" inputMode="tel" placeholder="(555) 123-4567" value={formatPhone(backgroundForm.phone)}
                        onChange={(e) => handleBackgroundChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} disabled={loading}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm font-mono disabled:opacity-40" />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground-secondary mb-1 font-medium">SSN <span className="text-foreground-secondary/50">(opt.)</span></label>
                      <input type="text" inputMode="numeric" placeholder="XXX-XX-XXXX" value={formatSsn(backgroundForm.ssn)}
                        onChange={(e) => handleBackgroundChange('ssn', e.target.value.replace(/\D/g, '').slice(0, 9))} disabled={loading}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-foreground-secondary/40 focus:outline-none focus:border-accent-gold/60 transition-all text-sm font-mono disabled:opacity-40" />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="mt-6">
                <button onClick={handleSubmit} disabled={isSubmitDisabled}
                  className="w-full relative overflow-hidden bg-gradient-to-r from-accent-gold via-accent-gold-light to-accent-gold text-black font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:shadow-2xl hover:shadow-accent-gold/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100 text-sm tracking-wide">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      {mode === 'identity' ? 'Verifying Identity…' : mode === 'phone' ? 'Looking up Phone…' : 'Running Background Check…'}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>🛡️</span>
                      {mode === 'identity' ? 'Run SSN Identity Verification' : mode === 'phone' ? 'Run Phone Lookup' : 'Run Background Search'}
                    </span>
                  )}
                </button>
              </div>

              {!error && !loading && (
                <div className="text-center mt-4 pt-4 border-t border-white/5 space-y-1">
                  <p className="text-[10px] text-foreground-secondary">
                    🔒 All identity data is encrypted in transit, processed securely, and <span className="text-emerald-400/70">never stored</span>.
                    Results are ephemeral and not retained after session close.
                  </p>
                  <p className="text-[10px] text-foreground-secondary">Subject to GLBA/FCRA permissible use requirements.</p>
                </div>
              )}
            </>
          )}

          {/* Rate limit */}
          {rateLimit && !loading && (
            <div className={`mt-3 px-3 py-1.5 rounded-lg border text-xs flex items-center justify-between ${
              rateLimit.remaining < 3 ? 'bg-red-500/10 border-red-500/30 text-red-400' : rateLimit.remaining < 8 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-foreground-secondary'
            }`}>
              <span>API Rate Limit</span>
              <span className="font-mono">{rateLimit.remaining} / 15 remaining</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mt-4">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="font-medium">Verification Error</p>
                  <p className="text-xs mt-0.5 opacity-80">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}