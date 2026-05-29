'use client';

import { useState } from 'react';

interface SystemSettings {
  siteName: string;
  siteDescription: string;
  defaultCredits: number;
  allowedFileTypes: string;
  maxFileSizeMb: number;
  maintenanceMode: boolean;
  enableRegistration: boolean;
  requireEmailVerification: boolean;
  enableVideoGeneration: boolean;
  enableMailer: boolean;
  enableLeadScraper: boolean;
}

const defaultSettingsVal: SystemSettings = {
  siteName: 'Silk Road V2',
  siteDescription: 'Elevate your document workflow with luxury AI-powered PDF summarization.',
  defaultCredits: 2,
  allowedFileTypes: 'pdf,docx,doc,txt',
  maxFileSizeMb: 50,
  maintenanceMode: false,
  enableRegistration: true,
  requireEmailVerification: false,
  enableVideoGeneration: true,
  enableMailer: true,
  enableLeadScraper: true,
};

type SettingsTab = 'general' | 'features' | 'limits' | 'branding';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettingsVal);
  const [activeSection, setActiveSection] = useState<SettingsTab>('general');
  const [saved, setSaved] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const update = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setRestoring(true);
    setSettings(defaultSettingsVal);
    setTimeout(() => setRestoring(false), 1000);
    setSaved(false);
  };

  const sections: { key: SettingsTab; label: string; icon: string }[] = [
    { key: 'general', label: 'General', icon: '⚙️' },
    { key: 'features', label: 'Features', icon: '🧩' },
    { key: 'limits', label: 'Limits', icon: '📏' },
    { key: 'branding', label: 'Branding', icon: '🎨' },
  ];

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif text-white mb-1">Settings</h1>
          <p className="text-foreground-secondary text-sm">Configure platform behavior, feature flags, and limits</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleReset} disabled={restoring} className="px-4 py-2.5 text-sm rounded-lg border border-white/10 text-foreground-secondary hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
            {restoring ? 'Restoring...' : 'Reset Defaults'}
          </button>
          <button onClick={handleSave} className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-xl hover:shadow-accent-gold/40 transition-all">
            Save Settings
          </button>
        </div>
      </div>

      {saved && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-400 animate-fade-in flex items-center gap-2">
          ✅ Settings saved successfully.
        </div>
      )}

      <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
        {sections.map((s) => (
          <button key={s.key} onClick={() => setActiveSection(s.key)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeSection === s.key ? 'bg-gradient-to-r from-accent-gold/20 to-accent-neon-blue/10 text-accent-gold border border-accent-gold/30' : 'text-foreground-secondary hover:text-white'}`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="glass-lg rounded-xl border border-white/5 p-8">
        {activeSection === 'general' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <label className="block text-sm text-foreground-secondary mb-2">Site Name</label>
              <input type="text" value={settings.siteName} onChange={(e) => update('siteName', e.target.value)} className="w-full py-2.5 px-4 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-foreground-secondary mb-2">Site Description</label>
              <textarea rows={3} value={settings.siteDescription} onChange={(e) => update('siteDescription', e.target.value)} className="w-full py-2.5 px-4 text-sm resize-none" />
            </div>
            <ToggleRow label="Maintenance Mode" desc="When enabled, only admins can access the site" value={settings.maintenanceMode} onChange={(v) => update('maintenanceMode', v)} />
            <ToggleRow label="Enable Registration" desc="Allow new users to sign up" value={settings.enableRegistration} onChange={(v) => update('enableRegistration', v)} />
            <ToggleRow label="Require Email Verification" desc="New users must verify their email before accessing the dashboard" value={settings.requireEmailVerification} onChange={(v) => update('requireEmailVerification', v)} />
          </div>
        )}
        {activeSection === 'features' && (
          <div className="space-y-4 max-w-2xl">
            <ToggleRow label="AI Video Generation" desc="Allow users to generate AI videos from PDF summaries" value={settings.enableVideoGeneration} onChange={(v) => update('enableVideoGeneration', v)} />
            <ToggleRow label="Silk Mailer" desc="Enable the email campaign and warm-up system" value={settings.enableMailer} onChange={(v) => update('enableMailer', v)} />
            <ToggleRow label="B2B Lead Scraper" desc="Enable lead scraping from Google Places and Serper" value={settings.enableLeadScraper} onChange={(v) => update('enableLeadScraper', v)} />
          </div>
        )}
        {activeSection === 'limits' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <label className="block text-sm text-foreground-secondary mb-2">Default Credits for New Users</label>
              <input type="number" min={0} max={1000} value={settings.defaultCredits} onChange={(e) => update('defaultCredits', Math.max(0, parseInt(e.target.value) || 0))} className="w-full py-2.5 px-4 text-sm max-w-[200px]" />
            </div>
            <div>
              <label className="block text-sm text-foreground-secondary mb-2">Allowed File Types (comma-separated)</label>
              <input type="text" value={settings.allowedFileTypes} onChange={(e) => update('allowedFileTypes', e.target.value)} className="w-full py-2.5 px-4 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-foreground-secondary mb-2">Maximum Upload Size (MB)</label>
              <input type="number" min={1} max={500} value={settings.maxFileSizeMb} onChange={(e) => update('maxFileSizeMb', Math.max(1, parseInt(e.target.value) || 1))} className="w-full py-2.5 px-4 text-sm max-w-[200px]" />
            </div>
          </div>
        )}
        {activeSection === 'branding' && (
          <div className="space-y-6 max-w-2xl">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-3xl font-bold text-black mb-4">S</div>
              <p className="text-white font-medium text-lg">{settings.siteName}</p>
              <p className="text-foreground-secondary text-sm mt-1">{settings.siteDescription}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs text-foreground-secondary mb-2">Color Scheme</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#d4af37] border border-white/20" title="Accent Gold" />
                <div className="w-10 h-10 rounded-lg bg-[#00aaff] border border-white/20" title="Neon Blue" />
                <div className="w-10 h-10 rounded-lg bg-[#0a0a0a] border border-white/20" title="Background" />
                <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-white/20" title="Secondary BG" />
              </div>
              <p className="text-xs text-foreground-secondary mt-3">Custom branding and logo upload coming soon.</p>
            </div>
          </div>
        )}
      </div>

      <div className="glass-lg rounded-xl border border-red-500/20 p-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">⚠️</span>
          <h3 className="text-lg font-serif text-white">Danger Zone</h3>
        </div>
        <p className="text-sm text-foreground-secondary mb-6">Irreversible actions that affect the entire platform.</p>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2.5 text-sm font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all">🗑️ Clear All Data</button>
          <button className="px-4 py-2.5 text-sm font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all">🔄 Reset All User Credits</button>
          <button className="px-4 py-2.5 text-sm font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all">🧹 Purge Temporary Files</button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        <p className="text-xs text-foreground-secondary mt-0.5">{desc}</p>
      </div>
      <button onClick={() => onChange(!value)} className={`relative w-12 h-6 rounded-full transition-all shrink-0 ${value ? 'bg-accent-gold' : 'bg-white/20'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  );
}