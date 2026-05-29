'use client';

import { useState, useEffect, useCallback } from 'react';

interface SmtpProvider {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string | null;
  bomberSubject: string | null;
  bomberHtml: string | null;
  isActive: boolean;
}

export default function AdminEmailBomberPage() {
  const [providers, setProviders] = useState<SmtpProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/smtp-providers?includeSensitive=true');
      const json = await res.json();
      if (json.ok) {
        setProviders(json.data);
        // Auto-select the active provider
        const active = json.data.find((p: SmtpProvider) => p.isActive);
        if (active) {
          setSelectedProviderId(active.id);
          setSubject(active.bomberSubject || '');
          setHtmlContent(active.bomberHtml || '');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const handleSelectProvider = (id: string) => {
    setSelectedProviderId(id);
    const provider = providers.find(p => p.id === id);
    if (provider) {
      setSubject(provider.bomberSubject || '');
      setHtmlContent(provider.bomberHtml || '');
    }
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedProviderId) {
      setError('Please select an SMTP provider first');
      return;
    }
    if (!subject.trim() || !htmlContent.trim()) {
      setError('Subject and HTML content are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/smtp-providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedProviderId,
          bomberSubject: subject.trim(),
          bomberHtml: htmlContent.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(json.error || 'Failed to save');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedProvider = providers.find(p => p.id === selectedProviderId);

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif text-white mb-1">💣 Email Bomber</h1>
          <p className="text-foreground-secondary text-sm">
            Configure the subject and HTML message sent when users launch the Email Bomber from the dashboard.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !selectedProviderId || !subject.trim() || !htmlContent.trim()}
          className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-xl hover:shadow-accent-gold/40 transition-all disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {saved && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-400 animate-fade-in flex items-center gap-2">
          ✅ Bomber configuration saved successfully.
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 flex items-center gap-2">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="glass-lg rounded-xl border border-white/5 p-8 text-center text-foreground-secondary">
          Loading SMTP providers...
        </div>
      ) : providers.length === 0 ? (
        <div className="glass-lg rounded-xl border border-white/5 p-12 text-center">
          <span className="text-4xl block mb-3">📧</span>
          <p className="text-lg text-white mb-1">No SMTP providers available</p>
          <p className="text-sm text-foreground-secondary mb-6">
            You need to configure an SMTP provider first in <strong>SMTP Providers</strong> before setting up the Email Bomber.
          </p>
          <a href="/admin/smtp-providers" className="inline-flex px-5 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-xl hover:shadow-accent-gold/40 transition-all">
            Go to SMTP Providers
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Provider Selector */}
          <div className="glass-lg rounded-xl border border-white/5 p-6">
            <h3 className="text-lg font-serif text-white mb-4">📧 Select SMTP Provider</h3>
            <p className="text-xs text-foreground-secondary mb-4">
              Choose which SMTP provider the Email Bomber will use to send emails.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProvider(p.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedProviderId === p.id
                      ? 'bg-accent-gold/10 border-accent-gold/40 ring-1 ring-accent-gold/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${p.isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <span className="text-sm text-white font-medium">{p.name}</span>
                  </div>
                  <p className="text-[10px] text-foreground-secondary">{p.host}:{p.port}</p>
                  <p className="text-[10px] text-foreground-secondary">{p.fromEmail}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Bomber Configuration */}
          {selectedProvider && (
            <div className="glass-lg rounded-xl border border-white/5 p-6">
              <h3 className="text-lg font-serif text-white mb-1">💣 Bomber Message</h3>
              <p className="text-xs text-foreground-secondary mb-5">
                This message will be sent to all recipients when users launch the Email Bomber from the dashboard.
                Sending via: <strong className="text-accent-gold">{selectedProvider.name}</strong> ({selectedProvider.fromEmail})
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm text-foreground-secondary mb-2">Subject Line *</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => { setSubject(e.target.value); setSaved(false); }}
                    placeholder="e.g., Exclusive Offer Just For You, {{firstName}}!"
                    className="w-full py-2.5 px-4 text-sm rounded-lg border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none"
                  />
                  <p className="text-xs text-foreground-secondary mt-1.5">
                    Merge tags: <code className="text-accent-gold">{'{{firstName}}'}</code> <code className="text-accent-gold">{'{{lastName}}'}</code> <code className="text-accent-gold">{'{{email}}'}</code>
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-foreground-secondary mb-2">HTML Content *</label>
                  <textarea
                    value={htmlContent}
                    onChange={(e) => { setHtmlContent(e.target.value); setSaved(false); }}
                    placeholder={`<h2>Hello {{firstName}},</h2><p>Check out our latest offers...</p>`}
                    rows={12}
                    className="w-full py-2.5 px-4 text-sm rounded-lg border border-white/10 bg-white/5 text-white font-mono focus:border-accent-gold focus:outline-none resize-none"
                  />
                  <p className="text-xs text-foreground-secondary mt-1.5">
                    Merge tags: <code className="text-accent-gold">{'{{firstName}}'}</code> <code className="text-accent-gold">{'{{lastName}}'}</code> <code className="text-accent-gold">{'{{email}}'}</code>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}