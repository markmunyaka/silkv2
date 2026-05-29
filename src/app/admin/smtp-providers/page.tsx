'use client';

import { useState, useEffect, useCallback } from 'react';

interface SmtpProvider {
  id: string;
  name: string;
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string | null;
  maxEmailsPerDay: number;
  maxEmailsPerHour: number;
  delayBetweenEmailsMs: number;
  bomberSubject: string | null;
  bomberHtml: string | null;
  bomberSmtpHost: string | null;
  bomberSmtpPort: number | null;
  bomberSmtpSecure: boolean | null;
  bomberSmtpUsername: string | null;
  bomberSmtpPassword: string | null;
  isActive: boolean;
  isVisibleToUsers: boolean;
  lastTestedAt: string | null;
  testStatus: string | null;
  testError: string | null;
  createdAt: string;
  updatedAt: string;
}

const PROVIDER_TYPES = [
  { value: 'custom', label: 'Custom SMTP', icon: '📧' },
  { value: 'aws_ses', label: 'AWS SES', icon: '☁️' },
  { value: 'sendgrid', label: 'SendGrid', icon: '✉️' },
];

  const defaultForm = {
    name: '',
    provider: 'custom',
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: '',
    maxEmailsPerDay: 300,
    maxEmailsPerHour: 50,
    delayBetweenEmailsMs: 200,
    bomberSubject: '',
    bomberHtml: '',
    bomberSmtpHost: '',
    bomberSmtpPort: 587,
    bomberSmtpSecure: false,
    bomberSmtpUsername: '',
    bomberSmtpPassword: '',
    isActive: true,
    isVisibleToUsers: true,
  };

type FormMode = 'create' | 'edit';

export default function AdminSmtpProvidersPage() {
  const [providers, setProviders] = useState<SmtpProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    verdict?: string;
    verdictLabel?: string;
    verdictColor?: string;
    summary?: string;
    message: string;
  } | null>(null);
  const [testDiagnostics, setTestDiagnostics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/smtp-providers?includeSensitive=true');
      const json = await res.json();
      if (json.ok) {
        setProviders(json.data);
      } else {
        setError(json.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const handleCreate = () => {
    setForm(defaultForm);
    setFormMode('create');
    setEditingId(null);
    setTestResult(null);
    setError(null);
    setShowForm(true);
  };

  const handleEdit = (provider: SmtpProvider) => {
    setForm({
      name: provider.name,
      provider: provider.provider,
      host: provider.host,
      port: provider.port,
      secure: provider.secure,
      username: provider.username,
      password: provider.password === '••••••••' ? '' : provider.password,
      fromEmail: provider.fromEmail,
      fromName: provider.fromName || '',
      maxEmailsPerDay: provider.maxEmailsPerDay,
      maxEmailsPerHour: provider.maxEmailsPerHour,
      delayBetweenEmailsMs: provider.delayBetweenEmailsMs,
      bomberSubject: provider.bomberSubject || '',
      bomberHtml: provider.bomberHtml || '',
      bomberSmtpHost: provider.bomberSmtpHost || '',
      bomberSmtpPort: provider.bomberSmtpPort || 587,
      bomberSmtpSecure: provider.bomberSmtpSecure ?? false,
      bomberSmtpUsername: provider.bomberSmtpUsername || '',
      bomberSmtpPassword: provider.bomberSmtpPassword === '••••••••' ? '' : (provider.bomberSmtpPassword || ''),
      isActive: provider.isActive,
      isVisibleToUsers: provider.isVisibleToUsers,
    });
    setFormMode('edit');
    setEditingId(provider.id);
    setTestResult(null);
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const url = '/api/admin/smtp-providers';
      const method = formMode === 'create' ? 'POST' : 'PATCH';
      const body = formMode === 'create'
        ? form
        : { id: editingId, ...form };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.ok) {
        setShowForm(false);
        fetchProviders();
      } else {
        setError(json.error || 'Failed to save SMTP provider');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the SMTP provider "${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/smtp-providers?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.ok) {
        fetchProviders();
      } else {
        alert(json.error || 'Failed to delete');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (provider: SmtpProvider) => {
    try {
      const res = await fetch('/api/admin/smtp-providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provider.id, isActive: !provider.isActive }),
      });
      const json = await res.json();
      if (json.ok) {
        fetchProviders();
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleToggleVisibility = async (provider: SmtpProvider) => {
    try {
      const res = await fetch('/api/admin/smtp-providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provider.id, isVisibleToUsers: !provider.isVisibleToUsers }),
      });
      const json = await res.json();
      if (json.ok) {
        fetchProviders();
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestDiagnostics(null);
    try {
      const res = await fetch('/api/admin/smtp-providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: form.host,
          port: form.port,
          secure: form.secure,
          username: form.username,
          password: form.password,
          fromEmail: form.fromEmail,
        }),
      });
      const json = await res.json();
      setTestResult({
        ok: json.ok,
        verdict: json.verdict,
        verdictLabel: json.verdictLabel,
        verdictColor: json.verdictColor,
        summary: json.summary,
        message: json.verdictLabel,
      });
      setTestDiagnostics(json.data?.diagnostics || null);
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const getProviderIcon = (type: string) => {
    const p = PROVIDER_TYPES.find((pt) => pt.value === type);
    return p?.icon || '📧';
  };

  const getProviderLabel = (type: string) => {
    const p = PROVIDER_TYPES.find((pt) => pt.value === type);
    return p?.label || type;
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif text-white mb-1">SMTP Providers</h1>
          <p className="text-foreground-secondary text-sm">
            Manage email sending infrastructure. Configure AWS SES, SendGrid, or custom SMTP servers.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-xl hover:shadow-accent-gold/40 transition-all flex items-center gap-2"
        >
          + Add Provider
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 flex items-center gap-2">
          ⚠️ {error}
        </div>
      )}

      {/* Provider Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8">
          <div className="glass-lg rounded-2xl border border-white/10 p-8 w-full max-w-2xl mx-4 my-8 animate-fade-in-up shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-serif text-white">
                {formMode === 'create' ? 'Add SMTP Provider' : 'Edit SMTP Provider'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-foreground-secondary hover:text-white text-lg">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-foreground-secondary mb-1">Provider Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Main AWS SES, SendGrid Pro" className="w-full py-2 px-3 text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-foreground-secondary mb-1">Type</label>
                  <div className="flex gap-2">
                    {PROVIDER_TYPES.map((pt) => (
                      <button
                        key={pt.value}
                        onClick={() => setForm({ ...form, provider: pt.value })}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                          form.provider === pt.value
                            ? 'bg-accent-gold/20 text-accent-gold border-accent-gold/40'
                            : 'bg-white/5 text-foreground-secondary border-white/10 hover:text-white'
                        }`}
                      >
                        {pt.icon} {pt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-foreground-secondary mb-1">SMTP Host *</label>
                  <input type="text" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="smtp.example.com" className="w-full py-2 px-3 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-foreground-secondary mb-1">Port</label>
                    <input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 587 })} className="w-full py-2 px-3 text-sm" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.secure} onChange={(e) => setForm({ ...form, secure: e.target.checked })} className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent-gold focus:ring-accent-gold" />
                      <span className="text-xs text-foreground-secondary">SSL/TLS</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-foreground-secondary mb-1">Username *</label>
                  <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="SMTP username" className="w-full py-2 px-3 text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-foreground-secondary mb-1">Password *</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="SMTP password" className="w-full py-2 px-3 text-sm" />
                  {formMode === 'edit' && !form.password && (
                    <p className="text-xs text-amber-400 mt-1">Leave empty to keep current password</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-foreground-secondary mb-1">From Email *</label>
                  <input type="email" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} placeholder="noreply@yourdomain.com" className="w-full py-2 px-3 text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-foreground-secondary mb-1">From Name</label>
                  <input type="text" value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} placeholder="Your Company" className="w-full py-2 px-3 text-sm" />
                </div>
              </div>
            </div>

            {/* Bomber Configuration */}
            <div className="mt-6 pt-5 border-t border-white/5">
              <p className="text-sm text-white font-medium mb-3">💣 Bomber Configuration</p>
              <p className="text-xs text-foreground-secondary mb-4">Configure the subject and HTML message used when users launch the Email Bomber.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-foreground-secondary mb-1">Bomber Subject *</label>
                  <input type="text" value={form.bomberSubject} onChange={(e) => setForm({ ...form, bomberSubject: e.target.value })} 
                    placeholder="e.g., Exclusive Offer Just For You, {{firstName}}!"
                    className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none" />
                  <p className="text-xs text-foreground-secondary mt-1">Supports merge tags: <code className="text-accent-gold">{'{{firstName}}'}</code> <code className="text-accent-gold">{'{{lastName}}'}</code> <code className="text-accent-gold">{'{{email}}'}</code></p>
                </div>
                <div>
                  <label className="block text-sm text-foreground-secondary mb-1">Bomber HTML Content *</label>
                  <textarea value={form.bomberHtml} onChange={(e) => setForm({ ...form, bomberHtml: e.target.value })}
                    placeholder={`<h2>Hello {{firstName}},</h2><p>Check out our latest offers...</p>`}
                    rows={8}
                    className="w-full py-2 px-3 text-sm rounded-lg border border-white/10 bg-white/5 text-white font-mono focus:border-accent-gold focus:outline-none resize-none" />
                  <p className="text-xs text-foreground-secondary mt-1">HTML email content. Supports <code className="text-accent-gold">{'{{firstName}}'}</code> <code className="text-accent-gold">{'{{lastName}}'}</code> <code className="text-accent-gold">{'{{email}}'}</code></p>
                </div>
              </div>
            </div>

            {/* Dedicated Bomber SMTP Section */}
            <div className="mt-6 pt-5 border-t border-white/5">
              <p className="text-sm text-white font-medium mb-1">🔌 Bomber SMTP (Optional)</p>
              <p className="text-xs text-foreground-secondary mb-4">
                Leave empty to reuse the main SMTP above. Set separate SMTP credentials if the bomber should use a different mail server.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-foreground-secondary mb-1">Bomber SMTP Host</label>
                    <input type="text" value={form.bomberSmtpHost} onChange={(e) => setForm({ ...form, bomberSmtpHost: e.target.value })} placeholder="smtp.bomber.com (optional)" className="w-full py-2 px-3 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-foreground-secondary mb-1">Bomber Port</label>
                      <input type="number" value={form.bomberSmtpPort} onChange={(e) => setForm({ ...form, bomberSmtpPort: parseInt(e.target.value) || 587 })} className="w-full py-2 px-3 text-sm" />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.bomberSmtpSecure} onChange={(e) => setForm({ ...form, bomberSmtpSecure: e.target.checked })} className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent-gold focus:ring-accent-gold" />
                        <span className="text-xs text-foreground-secondary">SSL/TLS</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-foreground-secondary mb-1">Bomber Username</label>
                    <input type="text" value={form.bomberSmtpUsername} onChange={(e) => setForm({ ...form, bomberSmtpUsername: e.target.value })} placeholder="Bomber SMTP username (optional)" className="w-full py-2 px-3 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-foreground-secondary mb-1">Bomber Password</label>
                    <input type="password" value={form.bomberSmtpPassword} onChange={(e) => setForm({ ...form, bomberSmtpPassword: e.target.value })} placeholder="Bomber SMTP password (optional)" className="w-full py-2 px-3 text-sm" />
                    {formMode === 'edit' && !form.bomberSmtpPassword && (
                      <p className="text-xs text-amber-400 mt-1">Leave empty to keep current bomber password</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Rate Limits Section */}
            <div className="mt-6 pt-5 border-t border-white/5">
              <p className="text-sm text-white font-medium mb-3">⚡ Rate Limits</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-foreground-secondary mb-1">Max/Day</label>
                  <input type="number" value={form.maxEmailsPerDay} onChange={(e) => setForm({ ...form, maxEmailsPerDay: parseInt(e.target.value) || 300 })} className="w-full py-2 px-3 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-foreground-secondary mb-1">Max/Hour</label>
                  <input type="number" value={form.maxEmailsPerHour} onChange={(e) => setForm({ ...form, maxEmailsPerHour: parseInt(e.target.value) || 50 })} className="w-full py-2 px-3 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-foreground-secondary mb-1">Delay (ms)</label>
                  <input type="number" value={form.delayBetweenEmailsMs} onChange={(e) => setForm({ ...form, delayBetweenEmailsMs: parseInt(e.target.value) || 200 })} className="w-full py-2 px-3 text-sm" />
                </div>
              </div>
            </div>

            {/* Visibility Toggles */}
            <div className="mt-4 flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent-gold focus:ring-accent-gold" />
                <span className="text-sm text-foreground-secondary">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isVisibleToUsers} onChange={(e) => setForm({ ...form, isVisibleToUsers: e.target.checked })} className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent-gold focus:ring-accent-gold" />
                <span className="text-sm text-foreground-secondary">Visible to Users</span>
              </label>
            </div>

            {/* Test Connection */}
            <div className="mt-6 pt-5 border-t border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={handleTest}
                  disabled={testing || !form.host || !form.username || !form.password}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-accent-neon-blue/30 text-accent-neon-blue hover:bg-accent-neon-blue/10 transition-all disabled:opacity-40"
                >
                  {testing ? '🔄 Testing...' : '🧪 Test Connection'}
                </button>
                {testResult && testResult.verdict && (
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
                    testResult.verdict === 'GOOD' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                    testResult.verdict === 'DEAD' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                    'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}>
                    {testResult.verdict === 'GOOD' ? '✅ GOOD' : testResult.verdict === 'DEAD' ? '❌ DEAD' : '⚠️ DEGRADED'}
                  </div>
                )}
              </div>

              {/* Verdict Banner */}
              {testResult && (
                <div className={`p-3 rounded-lg border text-sm mb-3 ${
                  testResult.verdict === 'GOOD' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                  testResult.verdict === 'DEAD' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                  'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">
                      {testResult.verdict === 'GOOD' ? '✅' : testResult.verdict === 'DEAD' ? '❌' : '⚠️'}
                    </span>
                    <div>
                      <p className="font-bold">{testResult.verdictLabel}</p>
                      {testResult.summary && (
                        <p className="text-xs mt-0.5 opacity-80">{testResult.summary}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Diagnostics Panel */}
              {testDiagnostics && (
                <div className="space-y-2 mt-3">
                  {[
                    { key: 'host', label: 'DNS Resolution', passLabel: 'Host resolves', failLabel: 'Host unreachable' },
                    { key: 'dns', label: 'MX & SPF Records', passLabel: 'Domain mail configured', failLabel: 'No mail records' },
                    { key: 'port', label: 'SMTP Connection', passLabel: 'Port open — handshake OK', failLabel: 'Connection failed' },
                    { key: 'send', label: 'Test Send', passLabel: 'Email sent successfully', failLabel: 'Send failed' },
                  ].map((check) => {
                    const diag = testDiagnostics[check.key];
                    if (!diag || diag.status === 'checking') return null;
                    const isPass = diag.status === 'pass';
                    const isWarn = diag.status === 'warn';
                    return (
                      <div key={check.key} className={`flex items-start gap-2.5 p-2 rounded-lg ${
                        isPass ? 'bg-emerald-500/5' : isWarn ? 'bg-amber-500/5' : 'bg-red-500/5'
                      }`}>
                        <span className="mt-0.5 text-sm">
                          {isPass ? '✅' : isWarn ? '⚠️' : '❌'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white">{check.label}</span>
                            <span className={`text-[10px] font-medium ${
                              isPass ? 'text-emerald-400' : isWarn ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {isPass ? check.passLabel : isWarn ? 'Warning' : check.failLabel}
                            </span>
                          </div>
                          <p className="text-[10px] text-foreground-secondary mt-0.5 leading-relaxed">
                            {diag.detail || diag.spfWarning || ''}
                          </p>
                          {diag.latencyMs && (
                            <p className="text-[10px] text-foreground-secondary/60 mt-0.5">
                              Response time: {diag.latencyMs}ms
                            </p>
                          )}
                          {diag.spf && (
                            <p className="text-[10px] text-emerald-400/60 mt-0.5 font-mono truncate">
                              SPF: {diag.spf}
                            </p>
                          )}
                          {diag.spfWarning && !diag.detail && (
                            <p className="text-[10px] text-amber-400/60 mt-0.5">{diag.spfWarning}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-white/5">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm rounded-lg border border-white/10 text-foreground-secondary hover:text-white transition-all">
                Cancel
              </button>
              <button
                onClick={handleSave}
              disabled={saving || !form.name || !form.host || !form.username || !form.password || !form.fromEmail || !form.bomberSubject || !form.bomberHtml}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-xl hover:shadow-accent-gold/40 transition-all disabled:opacity-40"
              >
                {saving ? 'Saving...' : formMode === 'create' ? 'Create Provider' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provider List */}
      <div className="glass-lg rounded-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="px-6 py-16 text-center text-foreground-secondary">Loading SMTP providers...</div>
        ) : providers.length === 0 ? (
          <div className="px-6 py-16 text-center text-foreground-secondary">
            <span className="text-4xl block mb-3">📧</span>
            <p className="text-lg mb-1">No SMTP providers configured</p>
            <p className="text-sm text-foreground-secondary/60">Add an SMTP provider to enable email sending for users.</p>
            <button onClick={handleCreate} className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-accent-gold/20 text-accent-gold border border-accent-gold/30 hover:bg-accent-gold/30 transition-all inline-flex items-center gap-1">
              + Add Your First Provider
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {providers.map((provider) => (
              <div key={provider.id} className="px-6 py-5 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${provider.isActive ? 'bg-accent-gold/20' : 'bg-white/5'}`}>
                      {getProviderIcon(provider.provider)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium">{provider.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          provider.provider === 'aws_ses' ? 'bg-amber-500/20 text-amber-400' :
                          provider.provider === 'sendgrid' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-white/10 text-foreground-secondary'
                        }`}>
                          {getProviderLabel(provider.provider)}
                        </span>
                        {provider.testStatus && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            provider.testStatus === 'passed' ? 'bg-emerald-500/20 text-emerald-400' :
                            provider.testStatus === 'failed' ? 'bg-red-500/20 text-red-400' :
                            'bg-white/10 text-foreground-secondary'
                          }`}>
                            {provider.testStatus === 'passed' ? '✅ Tested' : provider.testStatus === 'failed' ? '❌ Failed' : 'Untested'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-foreground-secondary">
                        <span>{provider.host}:{provider.port}</span>
                        <span>•</span>
                        <span>{provider.fromEmail}</span>
                        <span>•</span>
                        <span>{provider.maxEmailsPerDay}/day</span>
                        {provider.lastTestedAt && (
                          <>
                            <span>•</span>
                            <span>Tested: {new Date(provider.lastTestedAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleVisibility(provider)}
                      className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg border transition-all ${
                        provider.isVisibleToUsers
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-white/5 text-foreground-secondary border-white/10'
                      }`}
                      title={provider.isVisibleToUsers ? 'Users can see this provider' : 'Hidden from users'}
                    >
                      {provider.isVisibleToUsers ? '👁️ Visible' : '👁️‍🗨️ Hidden'}
                    </button>
                    <button
                      onClick={() => handleToggleActive(provider)}
                      className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg border transition-all ${
                        provider.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}
                    >
                      {provider.isActive ? '🟢 Active' : '🔴 Inactive'}
                    </button>
                    <button onClick={() => handleEdit(provider)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-gold/20 text-accent-gold border border-accent-gold/30 hover:bg-accent-gold/30 transition-all">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(provider.id, provider.name)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Integration Guide */}
      <div className="glass-lg rounded-xl border border-accent-neon-blue/20 p-6">
        <h3 className="text-lg font-serif text-white mb-3">🔌 Provider Integration Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <h4 className="text-sm font-medium text-accent-gold mb-2">☁️ AWS SES Setup</h4>
            <ul className="space-y-1.5 text-xs text-foreground-secondary">
              <li>• SMTP Host: <code className="text-white">email-smtp.{'{region}'}.amazonaws.com</code></li>
              <li>• Port: <code className="text-white">587</code> (TLS) or <code className="text-white">465</code> (SSL)</li>
              <li>• Username: Your SMTP username from IAM</li>
              <li>• Password: Your SMTP password from IAM</li>
              <li className="text-amber-400">⚠️ Must verify sending domain/email in SES</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <h4 className="text-sm font-medium text-accent-gold mb-2">✉️ SendGrid Setup</h4>
            <ul className="space-y-1.5 text-xs text-foreground-secondary">
              <li>• SMTP Host: <code className="text-white">smtp.sendgrid.net</code></li>
              <li>• Port: <code className="text-white">587</code> (TLS recommended)</li>
              <li>• Username: <code className="text-white">apikey</code> (literal)</li>
              <li>• Password: Your SendGrid API key</li>
              <li className="text-amber-400">⚠️ Must verify sender email in SendGrid</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <h4 className="text-sm font-medium text-accent-gold mb-2">📧 Custom SMTP</h4>
            <ul className="space-y-1.5 text-xs text-foreground-secondary">
              <li>• Works with any SMTP-compatible server</li>
              <li>• Supports STARTTLS (587) & SSL (465)</li>
              <li>• Enter your SMTP credentials</li>
              <li>• Use Test Connection to verify</li>
              <li className="text-emerald-400">✅ Great for private mail servers</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}