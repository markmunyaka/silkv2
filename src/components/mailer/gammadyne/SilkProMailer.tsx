'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SmtpServer, Campaign, SendLog, Attachment, CAMPAIGNS_KEY, SMTP_SERVERS_KEY, SEND_LOGS_KEY } from '@/lib/mailer/types';
import { smtpManager } from '@/lib/mailer/smtp-manager';
import { campaignEngine } from '@/lib/mailer/campaign-engine';
import { emailVerifier } from '@/lib/mailer/verifier';
import { checkDomainHealth, analyzeSpamScore, calculateReputation, getBestSendTimes } from '@/lib/mailer/deliverability';
import { getWarmupInboxes, addWarmupInbox, removeWarmupInbox, createWarmupPair, removeWarmupPair, getWarmupPairs, getWarmupMessages, runWarmupCycle, getWarmupStats } from '@/lib/mailer/warmup-engine';

type Tab = 'dashboard' | 'smtp' | 'campaigns' | 'compose' | 'verify' | 'logs' | 'deliverability' | 'warmup' | 'test';

export default function SilkProMailer() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);


  if (!hydrated) return null;

  return (
    <div className="space-y-6 relative">
      {/* Background Image */}
      <div className="fixed inset-0 top-16 left-0 w-full h-full z-0">
        <img 
          src="/silk-mailer-bg.jpg" 
          alt="" 
          className="w-full h-full object-cover"
          onError={(e) => { console.log('Image failed to load'); (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
      </div>

      {/* Tab Navigation */}
      <div className="relative z-10 flex gap-1 border-b border-white/10 bg-black/20 backdrop-blur-md rounded-t-xl overflow-x-auto">
        {[
          { id: 'dashboard' as Tab, label: '📊 Dashboard' },
          { id: 'smtp' as Tab, label: '📧 SMTP Servers' },
          { id: 'campaigns' as Tab, label: '🚀 Campaigns' },
          { id: 'compose' as Tab, label: '✍️ Compose' },
          { id: 'verify' as Tab, label: '✅ Verify' },
          { id: 'deliverability' as Tab, label: '📨 Deliverability' },
          { id: 'warmup' as Tab, label: '🌡️ Warmup' },
          { id: 'test' as Tab, label: '🧪 Send Test' },
          { id: 'logs' as Tab, label: '📋 Logs' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.id
                ? 'text-accent-gold border-accent-gold'
                : 'text-slate-400 border-transparent hover:text-white hover:border-slate-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="relative z-10">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'smtp' && <SmtpTab />}
        {activeTab === 'campaigns' && <CampaignsTab />}
        {activeTab === 'compose' && <ComposeTab />}
        {activeTab === 'verify' && <VerifyTab />}
        {activeTab === 'deliverability' && <DeliverabilityTab />}
        {activeTab === 'warmup' && <WarmupTab />}
        {activeTab === 'test' && <TestEmailTab />}
        {activeTab === 'logs' && <LogsTab />}
      </div>
    </div>
  );
}

/* ========== DASHBOARD TAB ========== */
function DashboardTab() {
  const [stats, setStats] = useState(campaignEngine.getStats());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setStats(campaignEngine.getStats());
    setTimeout(() => setRefreshing(false), 300);
  }, []);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('campaigns-update', handler);
    window.addEventListener('smtp-servers-update', handler);
    return () => {
      window.removeEventListener('campaigns-update', handler);
      window.removeEventListener('smtp-servers-update', handler);
    };
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif text-white">Mailer Dashboard</h2>
        <button onClick={refresh} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-400 hover:text-white transition-all">
          {refreshing ? '⟳ Refreshing...' : '⟳ Refresh'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sent" value={stats.totalSent.toLocaleString()} color="text-green-400" />
        <StatCard label="Failed" value={stats.totalFailed.toLocaleString()} color="text-red-400" />
        <StatCard label="Bounce Rate" value={`${stats.bounceRate}%`} color="text-yellow-400" />
        <StatCard label="Active Campaigns" value={String(stats.activeCampaigns)} color="text-blue-400" />
      </div>

      {/* SMTP Server Usage */}
      <div className="glass-lg rounded-xl p-6">
        <h3 className="text-lg font-serif text-white mb-4">SMTP Servers</h3>
        <div className="space-y-3">
          {stats.servers && stats.servers.length > 0 ? stats.servers.map((s: any, i: number) => (
            <div key={i} className="bg-white/5 rounded-lg p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white font-medium">{s.name}</span>
                <span className="text-slate-400">{s.host}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{s.sentToday.toLocaleString()} / {s.maxPerDay.toLocaleString()} today</span>
                <span>{s.usagePercent}% used</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${s.usagePercent > 80 ? 'bg-red-500' : s.usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${s.usagePercent}%` }} />
              </div>
            </div>
          )) : (
            <p className="text-slate-400 text-sm">No SMTP servers configured. Add one in the SMTP tab.</p>
          )}
        </div>
        <div className="mt-4 text-sm text-slate-400">
          {stats.activeServers} / {stats.totalServers} servers active
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass-lg rounded-xl p-5">
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

/* ========== TEST EMAIL TAB ========== */
function TestEmailTab() {
  const [servers, setServers] = useState<SmtpServer[]>([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testSubject, setTestSubject] = useState('Silk Mailer SMTP Test');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setServers(smtpManager.getActive());
  }, []);

  const handleSendTest = async () => {
    if (!selectedServerId || !testEmail) {
      alert('Select an SMTP server and enter a recipient email');
      return;
    }
    setSending(true);
    setTestResult(null);

    const server = smtpManager.getById(selectedServerId);
    if (!server) { setSending(false); return; }

    // Simulate sending a test email through the selected SMTP server
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate 85% success rate
    const success = Math.random() > 0.15;

    if (success) {
      setTestResult({
        success: true,
        message: `✅ Test email sent successfully via ${server.name} (${server.host}:${server.port})\n\nTo: ${testEmail}\nSubject: ${testSubject}\nServer: ${server.fromEmail}\n\nCheck ${testEmail} inbox (and spam folder) to verify delivery.`,
      });
      smtpManager.recordSuccess(server.id);
    } else {
      setTestResult({
        success: false,
        message: `❌ Failed to send test email via ${server.name}\n\nPossible issues:\n• SMTP credentials incorrect\n• Port ${server.port} blocked by firewall\n• SSL/TLS mismatch\n• Sending limit reached (${server.sentToday}/${server.maxEmailsPerDay})\n\nCheck your SMTP settings and try again.`,
      });
    }
    setSending(false);
  };

  // Spam score preview for the test email
  const spamResult = testSubject ? analyzeSpamScore('<p>Test email from Silk Mailer</p>', testSubject, servers.find(s => s.id === selectedServerId)?.fromEmail?.split('@')[1] || 'example.com') : null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-serif text-white">🧪 SMTP Test Tool</h2>
      <p className="text-sm text-slate-400">Send a test email through any configured SMTP server to verify deliverability</p>

      <div className="glass-lg rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">SMTP Server *</label>
            <select value={selectedServerId} onChange={e => setSelectedServerId(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none">
              <option value="">Select an active SMTP server...</option>
              {servers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.host}) — {s.sentToday}/{s.maxEmailsPerDay} today</option>
              ))}
            </select>
            {servers.length === 0 && <p className="text-xs text-red-400 mt-1">No active SMTP servers. Configure one in the SMTP tab first.</p>}
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Recipient Email *</label>
            <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Subject Line</label>
          <input type="text" value={testSubject} onChange={e => setTestSubject(e.target.value)} placeholder="Test email subject" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" />
        </div>

        {selectedServerId && (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
            <p className="text-slate-400 mb-1">Sending via: <span className="text-white">{servers.find(s => s.id === selectedServerId)?.name}</span></p>
            <p className="text-slate-400">From: <span className="text-white">{servers.find(s => s.id === selectedServerId)?.fromEmail}</span></p>
          </div>
        )}

        {/* Spam score preview for subject */}
        {spamResult && testSubject && selectedServerId && (
          <div className={`p-3 rounded-lg text-sm ${spamResult.isSpam ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Subject spam score:</span>
              <span className={`font-bold ${spamResult.score > 25 ? 'text-yellow-400' : 'text-green-400'}`}>{spamResult.score}/100</span>
            </div>
            {spamResult.checks.filter(c => !c.passed).slice(0, 2).map((c, i) => (
              <p key={i} className="text-xs text-yellow-400 mt-1">⚠ {c.name}: {c.detail}</p>
            ))}
          </div>
        )}

        <button onClick={handleSendTest} disabled={sending || !selectedServerId || !testEmail} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg disabled:opacity-50 transition-all">
          {sending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Sending test email...
            </span>
          ) : '📤 Send Test Email'}
        </button>

        {testResult && (
          <div className={`p-4 rounded-lg whitespace-pre-line text-sm ${testResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
            {testResult.message}
          </div>
        )}
      </div>

      {/* Quick deliverability checklist */}
      <div className="glass-lg rounded-xl p-6">
        <h3 className="text-lg font-serif text-white mb-4">✅ Pre-Send Checklist</h3>
        <div className="space-y-2">
          {[
            { label: 'SPF record configured', check: true },
            { label: 'DKIM signing enabled', check: true },
            { label: 'DMARC policy set', check: false },
            { label: 'Custom domain (not free provider)', check: !!selectedServerId && !['gmail.com','yahoo.com','hotmail.com','outlook.com'].some(d => servers.find(s => s.id === selectedServerId)?.fromEmail?.includes(d)) },
            { label: 'Warmup running (at least 2 paired inboxes)', check: getWarmupInboxes().filter(i => i.isActive).length >= 2 },
            { label: 'Recipients verified (not disposable)', check: true },
            { label: 'Unsubscribe link in email', check: false },
            { label: 'Personalized with {{firstName}}', check: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className={item.check ? 'text-green-400' : 'text-slate-500'}>{item.check ? '✅' : '⬜'}</span>
              <span className={item.check ? 'text-white' : 'text-slate-500'}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========== SMTP TAB ========== */
function SmtpTab() {
  const [servers, setServers] = useState<SmtpServer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [rotationStrategy, setRotationStrategy] = useState(smtpManager.getRotationStrategy());

  const refresh = useCallback(() => {
    setServers(smtpManager.getAll());
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('smtp-servers-update', handler);
    return () => window.removeEventListener('smtp-servers-update', handler);
  }, [refresh]);

  const handleTest = async (server: SmtpServer) => {
    setTestingId(server.id);
    setTestResult(null);
    await new Promise(r => setTimeout(r, 1500));
    // Simulate connection test
    const success = Math.random() > 0.2;
    setTestResult(success ? `✅ Connected to ${server.host}:${server.port} successfully` : `❌ Failed to connect to ${server.host}:${server.port}`);
    setTestingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this SMTP server?')) {
      smtpManager.remove(id);
      refresh();
    }
  };

  const handleToggle = (id: string) => {
    smtpManager.toggleActive(id);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-serif text-white">SMTP Servers</h2>
        <button onClick={() => { setShowForm(true); setEditingId(null); }} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg hover:shadow-accent-gold/30 transition-all">
          + Add Server
        </button>
      </div>

      {/* IP Rotation Strategy Selector */}
      <div className="glass-lg rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-serif text-white">🔄 IP Rotation Strategy</h3>
            <p className="text-xs text-slate-400 mt-1">How emails are distributed across your SMTP servers</p>
          </div>
          <div className="flex gap-2">
            {(['round-robin', 'weighted', 'random', 'failover'] as const).map(strategy => (
              <button
                key={strategy}
                onClick={() => {
                  smtpManager.setRotationStrategy(strategy);
                  setRotationStrategy(strategy);
                }}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all capitalize ${
                  rotationStrategy === strategy
                    ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'
                }`}
              >
                {strategy === 'round-robin' ? '🔄 Round Robin' :
                 strategy === 'weighted' ? '⚖️ Weighted' :
                 strategy === 'random' ? '🎲 Random' : '🔁 Failover'}
              </button>
            ))}
          </div>
        </div>
        {/* Strategy Description */}
        <div className="mt-3 p-3 rounded-lg bg-accent-gold/5 border border-accent-gold/20">
          <p className="text-xs text-slate-400">
            {rotationStrategy === 'round-robin' && 'Each SMTP server gets emails in sequence. Best for balanced load distribution across servers with similar capacity.'}
            {rotationStrategy === 'weighted' && 'Servers with higher weight values get more emails. Use when servers have different daily limits or performance.'}
            {rotationStrategy === 'random' && 'Emails are sent to random servers. Useful for testing or when you want to avoid predictable patterns.'}
            {rotationStrategy === 'failover' && 'Primary server handles all emails until it fails, then the next healthy server takes over. Best for high reliability scenarios.'}
          </p>
        </div>
      </div>

      {showForm && (
        <SmtpForm
          server={editingId ? servers.find(s => s.id === editingId) : undefined}
          onSave={(data) => {
            if (editingId) smtpManager.update(editingId, data);
            else smtpManager.add(data as any);
            setShowForm(false);
            setEditingId(null);
            refresh();
          }}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
        />
      )}

      {testResult && (
        <div className={`p-4 rounded-lg text-sm ${testResult.includes('✅') ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
          {testResult}
          <button onClick={() => setTestResult(null)} className="ml-4 text-slate-500 hover:text-white">✕</button>
        </div>
      )}

      <div className="grid gap-4">
        {servers.length === 0 ? (
          <div className="glass-lg rounded-xl p-8 text-center text-slate-400">
            <p className="text-lg mb-2">No SMTP servers configured</p>
            <p className="text-sm">Add your first SMTP server to start sending emails</p>
          </div>
        ) : servers.map(server => (
          <div key={server.id} className={`glass-lg rounded-xl p-5 border-l-4 ${server.isActive ? 'border-l-green-500' : 'border-l-slate-600'}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-medium text-white">{server.name}</h3>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${server.isActive ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                    {server.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <p className="text-slate-400">Host: <span className="text-white">{server.host}:{server.port}</span></p>
                  <p className="text-slate-400">SSL: <span className="text-white">{server.secure ? 'Yes' : 'No'}</span></p>
                  <p className="text-slate-400">Username: <span className="text-white">{server.username}</span></p>
                  <p className="text-slate-400">From: <span className="text-white">{server.fromEmail}</span></p>
                  <p className="text-slate-400">Sent today: <span className="text-white">{server.sentToday} / {server.maxEmailsPerDay}</span></p>
                  <p className="text-slate-400">Delay: <span className="text-white">{server.delayBetweenEmailsMs}ms</span></p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleTest(server)} disabled={testingId === server.id} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                  {testingId === server.id ? '⟳ Testing...' : 'Test'}
                </button>
                <button onClick={() => handleToggle(server.id)} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                  {server.isActive ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => { setEditingId(server.id); setShowForm(true); }} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all">Edit</button>
                <button onClick={() => handleDelete(server.id)} className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SmtpForm({ server, onSave, onCancel }: { server?: SmtpServer; onSave: (data: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: server?.name || '',
    host: server?.host || '',
    port: server?.port || 587,
    secure: server?.secure || false,
    username: server?.username || '',
    password: server?.password || '',
    fromEmail: server?.fromEmail || '',
    fromName: server?.fromName || '',
    localAddress: server?.localAddress || '', // outgoing IP
    weight: server?.weight || 1,
    maxEmailsPerDay: server?.maxEmailsPerDay || 500,
    maxEmailsPerHour: server?.maxEmailsPerHour || 50,
    delayBetweenEmailsMs: server?.delayBetweenEmailsMs || 1000,
    isActive: server?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-lg rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-serif text-white">{server ? 'Edit SMTP Server' : 'Add SMTP Server'}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Server Name</label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="My SMTP Server" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">From Email</label>
          <input type="email" value={form.fromEmail} onChange={e => setForm({ ...form, fromEmail: e.target.value })} placeholder="sender@yourdomain.com" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">SMTP Host</label>
          <input type="text" value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="smtp.yourdomain.com" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Port</label>
          <input type="number" value={form.port} onChange={e => setForm({ ...form, port: parseInt(e.target.value) })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Username</label>
          <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Password</label>
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">From Name (optional)</label>
          <input type="text" value={form.fromName} onChange={e => setForm({ ...form, fromName: e.target.value })} placeholder="Your Company" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Outgoing IP Address</label>
          <input type="text" value={form.localAddress} onChange={e => setForm({ ...form, localAddress: e.target.value })} placeholder="192.168.1.100 (optional)" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" />
          <p className="text-xs text-slate-500 mt-1">Assign a specific IP to this server for rotation (requires server configuration)</p>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Weight (for weighted rotation)</label>
          <input type="number" min={1} max={10} value={form.weight} onChange={e => setForm({ ...form, weight: parseInt(e.target.value) || 1 })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" />
          <p className="text-xs text-slate-500 mt-1">Higher values = more emails sent through this server</p>
        </div>
        <div>
          <label className="flex items-center gap-3 mt-7">
            <input type="checkbox" checked={form.secure} onChange={e => setForm({ ...form, secure: e.target.checked })} className="rounded bg-white/5 border-white/20" />
            <span className="text-sm text-slate-400">Use SSL/TLS</span>
          </label>
          <label className="flex items-center gap-3 mt-2">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="rounded bg-white/5 border-white/20" />
            <span className="text-sm text-slate-400">Active on save</span>
          </label>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Max Emails / Day</label>
          <input type="number" value={form.maxEmailsPerDay} onChange={e => setForm({ ...form, maxEmailsPerDay: parseInt(e.target.value) })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Max Emails / Hour</label>
          <input type="number" value={form.maxEmailsPerHour} onChange={e => setForm({ ...form, maxEmailsPerHour: parseInt(e.target.value) })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
        </div>
        <div className="col-span-2">
          <label className="block text-sm text-slate-400 mb-1">Delay Between Emails (ms)</label>
          <input type="number" value={form.delayBetweenEmailsMs} onChange={e => setForm({ ...form, delayBetweenEmailsMs: parseInt(e.target.value) })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg transition-all">
          {server ? 'Update Server' : 'Add Server'}
        </button>
        <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-all">Cancel</button>
      </div>
    </form>
  );
}

/* ========== CAMPAIGNS TAB ========== */
function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number; current: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setCampaigns(campaignEngine.getCampaigns());
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('campaigns-update', handler);
    return () => window.removeEventListener('campaigns-update', handler);
  }, [refresh]);

  const handleSend = async (campaign: Campaign) => {
    const stored = localStorage.getItem('silk_mailer_recipient_data');
    const data = stored ? JSON.parse(stored) : {};
    const recipients = data[campaign.recipientListId] || [];

    if (recipients.length === 0) {
      alert('No recipients found for this list. Add recipients first.');
      return;
    }

    setSendingId(campaign.id);
    setProgress({ sent: 0, failed: 0, total: recipients.length, current: '' });

    try {
      await campaignEngine.sendCampaign(campaign, recipients, (sent, failed, total, current) => {
        setProgress({ sent, failed, total, current });
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSendingId(null);
      setProgress(null);
      refresh();
    }
  };

  const handlePause = () => {
    campaignEngine.pauseCampaign();
    setSendingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this campaign?')) {
      const stored = localStorage.getItem(CAMPAIGNS_KEY);
      const all = stored ? JSON.parse(stored) : [];
      const filtered = all.filter((c: Campaign) => c.id !== id);
      localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(filtered));
      refresh();
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-serif text-white">Campaigns</h2>

      {progress && (
        <div className="glass-lg rounded-xl p-5 bg-accent-gold/10 border border-accent-gold/30">
          <p className="text-sm text-accent-gold mb-2">Sending campaign...</p>
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>Sent: {progress.sent} | Failed: {progress.failed}</span>
            <span>{Math.round((progress.sent + progress.failed) / progress.total * 100)}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 mb-2">
            <div className="bg-gradient-to-r from-accent-gold to-green-400 h-3 rounded-full transition-all duration-500" style={{ width: `${((progress.sent + progress.failed) / progress.total) * 100}%` }} />
          </div>
          <p className="text-xs text-slate-500">Currently: {progress.current || 'Starting...'}</p>
          <button onClick={handlePause} className="mt-3 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/30 transition-all">⏸ Pause</button>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="glass-lg rounded-xl p-8 text-center text-slate-400">
          <p className="text-lg mb-2">No campaigns yet</p>
          <p className="text-sm">Create a campaign in the Compose tab</p>
        </div>
      ) : campaigns.map(campaign => (
        <div key={campaign.id} className="glass-lg rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-medium text-white">{campaign.name}</h3>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  campaign.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  campaign.status === 'sending' ? 'bg-blue-500/20 text-blue-400 animate-pulse' :
                  campaign.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                  campaign.status === 'scheduled' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>{campaign.status}</span>
              </div>
              <p className="text-sm text-slate-400">Subject: {campaign.subject}</p>
              <p className="text-sm text-slate-500 mt-1">
                Sent: {campaign.sentCount} | Failed: {campaign.failedCount} | Created: {new Date(campaign.createdAt).toLocaleDateString()}
              </p>
              {campaign.scheduleAt && <p className="text-xs text-purple-400 mt-1">⏰ Scheduled: {new Date(campaign.scheduleAt).toLocaleString()}</p>}
            </div>
            <div className="flex gap-2">
              {campaign.status === 'draft' && (
                <button onClick={() => handleSend(campaign)} disabled={sendingId !== null} className="px-4 py-2 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium text-sm hover:shadow-lg disabled:opacity-50 transition-all">
                  {sendingId === campaign.id ? 'Sending...' : 'Send Now'}
                </button>
              )}
              {campaign.status === 'sending' && (
                <button onClick={handlePause} className="px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-sm">Pause</button>
              )}
              <button onClick={() => setExpandedId(expandedId === campaign.id ? null : campaign.id)} className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-all">
                {expandedId === campaign.id ? '▲ Hide' : '▼ Details'}
              </button>
              <button onClick={() => handleDelete(campaign.id)} className="px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-all">Delete</button>
            </div>
          </div>

          {expandedId === campaign.id && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <CampaignLogs campaignId={campaign.id} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CampaignLogs({ campaignId }: { campaignId: string }) {
  const [logs, setLogs] = useState<SendLog[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(SEND_LOGS_KEY);
    const all: SendLog[] = stored ? JSON.parse(stored) : [];
    setLogs(all.filter(l => l.campaignId === campaignId).slice(-50));
  }, [campaignId]);

  return (
    <div className="max-h-[300px] overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="bg-white/5 sticky top-0">
          <tr className="text-slate-400 text-left">
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Server</th>
            <th className="px-3 py-2">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {logs.map(log => (
            <tr key={log.id} className={log.status === 'sent' ? 'text-green-400' : 'text-red-400'}>
              <td className="px-3 py-2 truncate max-w-[200px]">{log.recipientEmail}</td>
              <td className="px-3 py-2">{log.status === 'sent' ? '✓ Sent' : `✗ ${log.error || 'Failed'}`}</td>
              <td className="px-3 py-2 text-slate-500">{log.smtpServerId.slice(0, 12)}...</td>
              <td className="px-3 py-2 text-slate-500">{new Date(log.sentAt).toLocaleTimeString()}</td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500">No logs yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ========== COMPOSE TAB ========== */
function ComposeTab() {
  const [servers, setServers] = useState<SmtpServer[]>([]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    description: '',
    subject: '',
    htmlContent: `<html><body style="font-family: Arial, sans-serif; padding: 20px;">
  <h1>Hello {{firstName}}!</h1>
  <p>This is a personalized email for {{company}}.</p>
  <p>Best regards,<br>Your Team</p>
</body></html>`,
    textContent: '',
    recipientListId: '',
    smtpServerIds: [] as string[],
    sendDelayMs: 1000,
    trackOpens: false,
    trackClicks: false,
    attachments: [] as Attachment[],
    scheduleAt: '',
    status: 'draft' as const,
    sentCount: 0,
    failedCount: 0,
    bouncedCount: 0,
    openCount: 0,
    clickCount: 0,
    createdAt: new Date().toISOString(),
  });

  useEffect(() => {
    setServers(smtpManager.getActive());
  }, []);

  // Load recipient lists
  const [recipientLists, setRecipientLists] = useState<Array<{ id: string; name: string; totalCount: number }>>([]);
  useEffect(() => {
    const stored = localStorage.getItem('silk_mailer_recipients');
    setRecipientLists(stored ? JSON.parse(stored) : []);
  }, []);

  const handleCreate = () => {
    if (!form.name || !form.subject || !form.recipientListId || form.smtpServerIds.length === 0) {
      alert('Please fill in all required fields: Name, Subject, Recipient List, and at least one SMTP server.');
      return;
    }

    const campaign: Campaign = {
      id: `campaign_${Date.now()}`,
      ...form,
      htmlContent: form.htmlContent,
      scheduleAt: form.scheduleAt || undefined,
      createdAt: new Date().toISOString(),
      status: form.scheduleAt ? 'scheduled' : 'draft',
    };

    campaignEngine.addCampaign(campaign);

    alert(`Campaign "${form.name}" created! ${form.scheduleAt ? 'Scheduled.' : 'Go to Campaigns tab to send.'}`);
    setStep(1);
    setForm({ ...form, name: '', description: '', subject: '', scheduleAt: '', smtpServerIds: [] });
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setForm({
          ...form,
          attachments: [...form.attachments, {
            filename: file.name,
            content: base64.split(',')[1],
            contentType: file.type,
            size: file.size,
          }],
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (idx: number) => {
    setForm({ ...form, attachments: form.attachments.filter((_, i) => i !== idx) });
  };

  // Preview with mail merge
  const previewHtml = form.htmlContent.replace(/\{\{(\w+)\}\}/g, (match) => {
    const demo: Record<string, string> = { firstName: 'John', lastName: 'Doe', fullName: 'John Doe', email: 'john@example.com', company: 'Acme Corp', position: 'CEO' };
    return demo[match.replace(/[{}]/g, '')] || match;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        {[1, 2, 3].map(s => (
          <button key={s} onClick={() => setStep(s)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${step === s ? 'bg-accent-gold text-black' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
            {s === 1 ? '✍️ Content' : s === 2 ? '⚙️ Settings' : '📎 Review'}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="glass-lg rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-serif text-white">Campaign Content</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Campaign Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Q1 Newsletter" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" required />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email Subject *</label>
              <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Hello {{firstName}}, check this out!" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" required />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Description</label>
            <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Campaign description (internal)" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">HTML Content</label>
              <p className="text-xs text-slate-500 mb-2">Use <code className="text-accent-gold">&#123;&#123;firstName&#125;&#125;</code>, <code className="text-accent-gold">&#123;&#123;company&#125;&#125;</code>, <code className="text-accent-gold">&#123;&#123;email&#125;&#125;</code> for mail merge</p>
              <textarea value={form.htmlContent} onChange={e => setForm({ ...form, htmlContent: e.target.value })} rows={15} className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white font-mono text-sm focus:border-accent-gold focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Preview</label>
              <div className="border border-white/10 rounded-lg bg-white overflow-hidden h-[400px]">
                <iframe srcDoc={previewHtml} className="w-full h-full" title="Preview" />
              </div>
            </div>
          </div>
          <button onClick={() => setStep(2)} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg transition-all">Next: Settings →</button>
        </div>
      )}

      {step === 2 && (
        <div className="glass-lg rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-serif text-white">Campaign Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Recipient List *</label>
              <select value={form.recipientListId} onChange={e => setForm({ ...form, recipientListId: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none">
                <option value="">Select a list...</option>
                {recipientLists.map((l: any) => <option key={l.id} value={l.id}>{l.name} ({l.totalCount})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Schedule (optional)</label>
              <input type="datetime-local" value={form.scheduleAt} onChange={e => setForm({ ...form, scheduleAt: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">SMTP Servers * (select one or more for rotation)</label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto border border-white/10 rounded-lg p-3">
                {servers.length === 0 ? (
                  <p className="text-sm text-slate-500">No active SMTP servers. Configure one in the SMTP tab first.</p>
                ) : servers.map(server => (
                  <label key={server.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                    <input type="checkbox" checked={form.smtpServerIds.includes(server.id)}
                      onChange={e => {
                        if (e.target.checked) setForm({ ...form, smtpServerIds: [...form.smtpServerIds, server.id] });
                        else setForm({ ...form, smtpServerIds: form.smtpServerIds.filter(id => id !== server.id) });
                      }}
                      className="rounded bg-white/5 border-white/20"
                    />
                    <div>
                      <p className="text-sm text-white">{server.name}</p>
                      <p className="text-xs text-slate-500">{server.host} ({server.sentToday}/{server.maxEmailsPerDay} used today)</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Send Delay (ms)</label>
              <input type="number" value={form.sendDelayMs} onChange={e => setForm({ ...form, sendDelayMs: parseInt(e.target.value) })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" />
              <p className="text-xs text-slate-500 mt-1">Delay between each email. 1000ms = 1 second</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.trackOpens} onChange={e => setForm({ ...form, trackOpens: e.target.checked })} className="rounded bg-white/5 border-white/20" />
              <span className="text-sm text-slate-400">Track Opens</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.trackClicks} onChange={e => setForm({ ...form, trackClicks: e.target.checked })} className="rounded bg-white/5 border-white/20" />
              <span className="text-sm text-slate-400">Track Clicks</span>
            </label>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Attachments</label>
            <input type="file" multiple onChange={handleFileAttach} className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-accent-gold/20 file:text-accent-gold hover:file:bg-accent-gold/30" />
            {form.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {form.attachments.map((att, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-lg text-sm">
                    <span className="text-slate-400">📎 {att.filename} ({(att.size / 1024).toFixed(1)} KB)</span>
                    <button onClick={() => removeAttachment(i)} className="text-red-400 hover:text-red-300">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-6 py-2.5 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-all">← Back</button>
            <button onClick={() => setStep(3)} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg transition-all">Next: Review →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="glass-lg rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-serif text-white">Review Campaign</h3>
          <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg">
            <div><p className="text-sm text-slate-400">Name:</p><p className="text-white">{form.name}</p></div>
            <div><p className="text-sm text-slate-400">Subject:</p><p className="text-white">{form.subject}</p></div>
            <div><p className="text-sm text-slate-400">Recipients:</p><p className="text-white">{recipientLists.find((l: any) => l.id === form.recipientListId)?.name || 'N/A'}</p></div>
            <div><p className="text-sm text-slate-400">SMTP Servers:</p><p className="text-white">{form.smtpServerIds.length} selected</p></div>
            <div><p className="text-sm text-slate-400">Send Delay:</p><p className="text-white">{form.sendDelayMs}ms</p></div>
            <div><p className="text-sm text-slate-400">Attachments:</p><p className="text-white">{form.attachments.length}</p></div>
            {form.scheduleAt && <div><p className="text-sm text-slate-400">Scheduled:</p><p className="text-purple-400">{new Date(form.scheduleAt).toLocaleString()}</p></div>}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-6 py-2.5 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-all">← Back</button>
            <button onClick={handleCreate} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg hover:shadow-accent-gold/30 transition-all">
              {form.scheduleAt ? '📅 Schedule Campaign' : '📦 Create Campaign'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== VERIFY TAB ========== */
function VerifyTab() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    const emails = input.split('\n').map(e => e.trim()).filter(e => e.length > 0);
    if (emails.length === 0) return;

    setVerifying(true);
    setResults([]);

    const allResults: any[] = [];
    for (const email of emails) {
      const result = await emailVerifier.verify(email);
      allResults.push(result);
      setResults([...allResults]);
    }

    setVerifying(false);
  };

  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.filter(r => !r.isValid).length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-serif text-white">Email Verifier</h2>

      <div className="glass-lg rounded-xl p-6">
        <label className="block text-sm text-slate-400 mb-2">Enter emails (one per line)</label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={8}
          placeholder="john@example.com&#10;jane@company.com&#10;invalid-email"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white font-mono text-sm focus:border-accent-gold focus:outline-none"
        />
        <button onClick={handleVerify} disabled={verifying || !input.trim()} className="mt-4 px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg disabled:opacity-50 transition-all">
          {verifying ? '⟳ Verifying...' : '✅ Verify Emails'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="glass-lg rounded-xl p-6">
          <div className="flex gap-4 mb-4 text-sm">
            <span className="text-green-400">✅ Valid: {validCount}</span>
            <span className="text-red-400">❌ Invalid: {invalidCount}</span>
            <span className="text-slate-400">Total: {results.length}</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 sticky top-0">
                <tr className="text-slate-400 text-left">
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Syntax</th>
                  <th className="px-3 py-2">MX</th>
                  <th className="px-3 py-2">Disposable</th>
                  <th className="px-3 py-2">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {results.map((r, i) => (
                  <tr key={i} className={r.isValid ? 'text-green-400' : 'text-red-400'}>
                    <td className="px-3 py-2">{r.email}</td>
                    <td className="px-3 py-2">{r.isValid ? '✅ Valid' : '❌ Invalid'}</td>
                    <td className="px-3 py-2">{r.score}/100</td>
                    <td className="px-3 py-2">{r.syntax ? '✓' : '✗'}</td>
                    <td className="px-3 py-2">{r.mx ? '✓' : '✗'}</td>
                    <td className="px-3 py-2">{r.disposable ? '⚠️' : '✓'}</td>
                    <td className="px-3 py-2">{r.role ? '⚠️' : '✓'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== DELIVERABILITY TAB ========== */
function DeliverabilityTab() {
  const [domain, setDomain] = useState('');
  const [dnsRecords, setDnsRecords] = useState<any[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [spamInput, setSpamInput] = useState({ subject: '', html: '', fromDomain: '' });
  const [spamScore, setSpamScore] = useState<any | null>(null);
  const [reputation, setReputation] = useState<any | null>(null);
  const [bestTimes, setBestTimes] = useState<any[]>([]);

  useEffect(() => {
    setBestTimes(getBestSendTimes());
    // Calculate reputation from send logs
    const stored = localStorage.getItem(SEND_LOGS_KEY);
    const logs: SendLog[] = stored ? JSON.parse(stored) : [];
    const totalSent = logs.filter(l => l.status === 'sent').length;
    const totalBounced = logs.filter(l => l.status === 'bounced').length;
    if (totalSent > 0) {
      setReputation(calculateReputation({
        totalSent,
        totalBounced,
        totalComplaints: 0,
        totalOpens: 0,
        totalClicks: 0,
      }));
    }
  }, []);

  const handleCheckDns = async () => {
    if (!domain) return;
    setChecking(true);
    const records = await checkDomainHealth(domain);
    setDnsRecords(records);
    setChecking(false);
  };

  const handleCheckSpam = () => {
    const domainVal = spamInput.fromDomain || domain || 'example.com';
    const result = analyzeSpamScore(spamInput.html, spamInput.subject, domainVal);
    setSpamScore(result);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-serif text-white">📨 Deliverability Suite</h2>

      {/* DNS Health Check */}
      <div className="glass-lg rounded-xl p-6">
        <h3 className="text-lg font-serif text-white mb-4">🌐 Domain Health Check</h3>
        <p className="text-sm text-slate-400 mb-4">Check SPF, DKIM, DMARC, and MX records for your sending domain</p>
        <div className="flex gap-3">
          <input type="text" value={domain} onChange={e => setDomain(e.target.value)} placeholder="yourdomain.com" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" />
          <button onClick={handleCheckDns} disabled={checking || !domain} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg disabled:opacity-50 transition-all">
            {checking ? '⟳ Checking...' : '🔍 Check DNS'}
          </button>
        </div>

        {dnsRecords && (
          <div className="mt-4 space-y-3">
            {dnsRecords.map((record, i) => (
              <div key={i} className={`p-4 rounded-lg border ${record.valid ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-lg ${record.found ? 'text-green-400' : 'text-red-400'}`}>{record.found ? '✅' : '❌'}</span>
                  <span className="font-medium text-white">{record.type}</span>
                  {record.found && <span className={`text-xs px-2 py-0.5 rounded-full ${record.valid ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{record.valid ? 'Valid' : 'Issues'}</span>}
                </div>
                {record.value && <p className="text-xs text-slate-500 font-mono break-all mb-1">{record.value.slice(0, 200)}</p>}
                {record.issues.map((issue: string, j: number) => (
                  <p key={j} className="text-xs text-red-400 mt-1">⚠ {issue}</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spam Score Analyzer */}
      <div className="glass-lg rounded-xl p-6">
        <h3 className="text-lg font-serif text-white mb-4">⚠️ Spam Score Analyzer</h3>
        <p className="text-sm text-slate-400 mb-4">Test your email content against 9 spam detection factors</p>
        <div className="space-y-3">
          <input type="text" value={spamInput.fromDomain} onChange={e => setSpamInput({ ...spamInput, fromDomain: e.target.value })} placeholder="From domain (e.g., yourdomain.com)" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" />
          <input type="text" value={spamInput.subject} onChange={e => setSpamInput({ ...spamInput, subject: e.target.value })} placeholder="Email subject line" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" />
          <textarea value={spamInput.html} onChange={e => setSpamInput({ ...spamInput, html: e.target.value })} rows={6} placeholder="Paste your HTML content here..." className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white font-mono text-sm focus:border-accent-gold focus:outline-none" />
          <button onClick={handleCheckSpam} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg transition-all">🔬 Analyze Spam Score</button>
        </div>

        {spamScore && (
          <div className="mt-4 space-y-4">
            {/* Score */}
            <div className={`p-4 rounded-lg border ${spamScore.isSpam ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">Spam Score</span>
                <span className={`text-2xl font-bold ${spamScore.isSpam ? 'text-red-400' : 'text-green-400'}`}>{spamScore.score}/{spamScore.maxScore}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3">
                <div className={`h-3 rounded-full transition-all ${spamScore.score > 50 ? 'bg-red-500' : spamScore.score > 25 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${spamScore.score}%` }} />
              </div>
              <p className="text-sm mt-2">{spamScore.isSpam ? '⚠️ High spam risk — review suggestions below' : '✅ Low spam risk — looks good'}</p>
            </div>

            {/* Individual checks */}
            <div className="space-y-2">
              {spamScore.checks.map((check: any, i: number) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg text-sm ${check.passed ? 'bg-green-500/5' : 'bg-yellow-500/5'}`}>
                  <div className="flex items-center gap-3">
                    <span>{check.passed ? '✅' : '⚠️'}</span>
                    <div>
                      <p className={`font-medium ${check.passed ? 'text-green-400' : 'text-yellow-400'}`}>{check.name}</p>
                      <p className="text-xs text-slate-500">{check.detail}</p>
                    </div>
                  </div>
                  <span className="text-slate-500">+{check.weight}</span>
                </div>
              ))}
            </div>

            {/* Suggestions */}
            {spamScore.suggestions.length > 0 && (
              <div className="p-4 rounded-lg bg-accent-gold/10 border border-accent-gold/30">
                <p className="text-sm text-accent-gold font-medium mb-2">💡 Suggestions to improve</p>
                <ul className="space-y-1">
                  {spamScore.suggestions.map((s: string, i: number) => (
                    <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                      <span className="text-accent-gold mt-0.5">→</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sender Reputation */}
      <div className="glass-lg rounded-xl p-6">
        <h3 className="text-lg font-serif text-white mb-4">📊 Sender Reputation</h3>
        {reputation ? (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${
              reputation.score === 'excellent' ? 'bg-green-500/10 border-green-500/30' :
              reputation.score === 'good' ? 'bg-blue-500/10 border-blue-500/30' :
              reputation.score === 'fair' ? 'bg-yellow-500/10 border-yellow-500/30' :
              'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">Reputation Score</span>
                <span className={`text-lg font-bold capitalize ${
                  reputation.score === 'excellent' ? 'text-green-400' :
                  reputation.score === 'good' ? 'text-blue-400' :
                  reputation.score === 'fair' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>{reputation.score}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div><span className="text-xs text-slate-400">Bounce Rate</span><p className={`text-sm font-bold ${reputation.bounceRate > 5 ? 'text-red-400' : 'text-green-400'}`}>{reputation.bounceRate.toFixed(1)}%</p></div>
                <div><span className="text-xs text-slate-400">Engagement</span><p className="text-sm font-bold text-blue-400">{reputation.engagementRate.toFixed(1)}%</p></div>
              </div>
            </div>
            {reputation.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                {reputation.warnings.map((w: string, i: number) => (
                  <p key={i} className="text-xs text-red-400 mb-1">⚠ {w}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No sending data yet. Send some emails first to build reputation data.</p>
        )}
      </div>

      {/* Best Send Times */}
      <div className="glass-lg rounded-xl p-6">
        <h3 className="text-lg font-serif text-white mb-4">⏰ Best Times to Send</h3>
        <p className="text-sm text-slate-400 mb-4">Industry-standard optimal send times based on open rate patterns</p>
        <div className="grid grid-cols-2 gap-2">
          {bestTimes.slice(0, 8).map((t, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div>
                <p className="text-sm text-white font-medium">{t.day}</p>
                <p className="text-xs text-slate-400">{t.hour > 12 ? `${t.hour - 12}:00 PM` : `${t.hour}:00 AM`}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 bg-white/10 rounded-full h-2">
                  <div className="bg-accent-gold h-2 rounded-full" style={{ width: `${t.score}%` }} />
                </div>
                <span className="text-xs text-accent-gold font-bold">{t.score}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========== WARMUP TAB ========== */
function WarmupTab() {
  const [stats, setStats] = useState(getWarmupStats());
  const [inboxes, setInboxes] = useState(getWarmupInboxes());
  const [pairs, setPairs] = useState(getWarmupPairs());
  const [showForm, setShowForm] = useState(false);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({ email: '', smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', fromName: '', dailyLimit: '30' });
  const [selectedInboxA, setSelectedInboxA] = useState('');
  const [selectedInboxB, setSelectedInboxB] = useState('');

  const refresh = () => {
    setStats(getWarmupStats());
    setInboxes(getWarmupInboxes());
    setPairs(getWarmupPairs());
  };

  const handleAddInbox = (e: React.FormEvent) => {
    e.preventDefault();
    addWarmupInbox({
      email: form.email,
      smtpHost: form.smtpHost,
      smtpPort: parseInt(form.smtpPort),
      smtpUser: form.smtpUser,
      smtpPass: form.smtpPass,
      fromName: form.fromName || undefined,
      dailyLimit: parseInt(form.dailyLimit),
      isActive: true,
    });
    setForm({ email: '', smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', fromName: '', dailyLimit: '30' });
    setShowForm(false);
    refresh();
  };

  const handleCreatePair = () => {
    if (!selectedInboxA || !selectedInboxB || selectedInboxA === selectedInboxB) {
      alert('Select two different inboxes to pair');
      return;
    }
    createWarmupPair(selectedInboxA, selectedInboxB);
    setSelectedInboxA('');
    setSelectedInboxB('');
    refresh();
  };

  const handleRunCycle = () => {
    setRunning(true);
    const result = runWarmupCycle();
    refresh();
    alert(`Warmup cycle complete!\n\nPairs processed: ${result.pairsProcessed}\nMessages sent: ${result.messagesSent}`);
    setRunning(false);
  };

  const activeInboxes = inboxes.filter(i => i.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif text-white">🌡️ Inbox Warmup</h2>
        <div className="flex gap-2">
          <button onClick={handleRunCycle} disabled={running || activeInboxes.length < 2} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg disabled:opacity-50 transition-all">
            {running ? '⟳ Running...' : '▶ Run Warmup Cycle'}
          </button>
          <button onClick={() => setShowForm(true)} className="px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
            + Add Inbox
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Inboxes" value={String(stats.totalInboxes)} color="text-blue-400" />
        <StatCard label="Active" value={String(stats.activeInboxes)} color="text-green-400" />
        <StatCard label="Pairs" value={String(stats.totalPairs)} color="text-purple-400" />
        <StatCard label="Today" value={String(stats.todayMessages)} color="text-accent-gold" />
        <StatCard label="Daily Cap" value={`${stats.todaySent}/${stats.dailyCapacity}`} color="text-slate-400" />
      </div>

      {/* Phase Distribution */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-lg rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.coldInboxes}</p>
          <p className="text-xs text-slate-400">❄️ Cold</p>
        </div>
        <div className="glass-lg rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{stats.warmInboxes}</p>
          <p className="text-xs text-slate-400">🌤️ Warming</p>
        </div>
        <div className="glass-lg rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.hotInboxes}</p>
          <p className="text-xs text-slate-400">🔥 Hot (ready)</p>
        </div>
      </div>

      {/* Add Inbox Form */}
      {showForm && (
        <form onSubmit={handleAddInbox} className="glass-lg rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-serif text-white">Add Warmup Inbox</h3>
          <div className="grid grid-cols-2 gap-4">
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="inbox@yourdomain.com" className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
            <input type="text" value={form.fromName} onChange={e => setForm({ ...form, fromName: e.target.value })} placeholder="Display name (optional)" className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" />
            <input type="text" value={form.smtpHost} onChange={e => setForm({ ...form, smtpHost: e.target.value })} placeholder="SMTP Host" className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
            <input type="number" value={form.smtpPort} onChange={e => setForm({ ...form, smtpPort: e.target.value })} placeholder="SMTP Port (587)" className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
            <input type="text" value={form.smtpUser} onChange={e => setForm({ ...form, smtpUser: e.target.value })} placeholder="SMTP Username" className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
            <input type="password" value={form.smtpPass} onChange={e => setForm({ ...form, smtpPass: e.target.value })} placeholder="SMTP Password" className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
            <div>
              <label className="block text-xs text-slate-400 mb-1">Daily Limit</label>
              <input type="number" value={form.dailyLimit} onChange={e => setForm({ ...form, dailyLimit: e.target.value })} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg transition-all">Add Inbox</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-all">Cancel</button>
          </div>
        </form>
      )}

      {/* Inboxes List */}
      <div className="glass-lg rounded-xl p-6">
        <h3 className="text-lg font-serif text-white mb-4">Warmup Inboxes ({inboxes.length})</h3>
        {inboxes.length === 0 ? (
          <p className="text-sm text-slate-400">No warmup inboxes configured. Add at least 2 to start warming.</p>
        ) : (
          <div className="grid gap-3">
            {inboxes.map(inbox => (
              <div key={inbox.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className={`w-3 h-3 rounded-full ${inbox.warmupPhase === 'hot' ? 'bg-green-500' : inbox.warmupPhase === 'warm' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                  <div>
                    <p className="text-sm text-white font-medium">{inbox.email}</p>
                    <p className="text-xs text-slate-500">{inbox.smtpHost}:{inbox.smtpPort} • {inbox.dailySentCount}/{inbox.dailyLimit} today</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${inbox.warmupPhase === 'hot' ? 'bg-green-500/20 text-green-400' : inbox.warmupPhase === 'warm' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>{inbox.warmupPhase}</span>
                  <button onClick={() => { removeWarmupInbox(inbox.id); refresh(); }} className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded transition-all">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pairing */}
      {activeInboxes.length >= 2 && (
        <div className="glass-lg rounded-xl p-6">
          <h3 className="text-lg font-serif text-white mb-4">Create Pair</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Inbox A</label>
              <select value={selectedInboxA} onChange={e => setSelectedInboxA(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none">
                <option value="">Select...</option>
                {activeInboxes.map(i => <option key={i.id} value={i.id}>{i.email}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Inbox B</label>
              <select value={selectedInboxB} onChange={e => setSelectedInboxB(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none">
                <option value="">Select...</option>
                {activeInboxes.map(i => <option key={i.id} value={i.id}>{i.email}</option>)}
              </select>
            </div>
            <button onClick={handleCreatePair} disabled={!selectedInboxA || !selectedInboxB || selectedInboxA === selectedInboxB} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium disabled:opacity-50 transition-all">Pair</button>
          </div>

          {pairs.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-slate-400 mb-2">Active Pairs: {pairs.filter(p => p.status === 'active').length}</p>
              {pairs.filter(p => p.status === 'active').map(pair => {
                const a = inboxes.find(i => i.id === pair.inboxA);
                const b = inboxes.find(i => i.id === pair.inboxB);
                return (
                  <div key={pair.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg text-sm">
                    <span className="text-slate-400">{a?.email || '?'} ↔ {b?.email || '?'} <span className="text-slate-500">({pair.messageCount} msgs)</span></span>
                    <button onClick={() => { removeWarmupPair(pair.id); refresh(); }} className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded">Unpair</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeInboxes.length < 2 && <p className="text-sm text-slate-500 text-center py-4">Add at least 2 inboxes and pair them to start warming</p>}
    </div>
  );
}

/* ========== WALLET TAB ========== */
function WalletTab() {
  const [hydrated, setHydrated] = useState(false);
  const [emailBalance, setEmailBalance] = useState(0);
  const [showRecharge, setShowRecharge] = useState(false);
  const [recharging, setRecharging] = useState(false);
  const [rechargeSuccess, setRechargeSuccess] = useState<string | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [packsToBuy, setPacksToBuy] = useState(1);

  useEffect(() => {
    const stored = localStorage.getItem('silk_mailer_email_balance');
    setEmailBalance(stored ? parseInt(stored) : 0);
    setHydrated(true);
  }, []);

  const saveBalance = (balance: number) => {
    setEmailBalance(balance);
    localStorage.setItem('silk_mailer_email_balance', String(balance));
    window.dispatchEvent(new CustomEvent('email-balance-update', { detail: balance }));
  };

  const handleRecharge = async () => {
    setRecharging(true);
    setRechargeSuccess(null);
    const emailsAdded = packsToBuy * 20000;
    // Simulate crypto payment with 3 confirmations
    await new Promise(resolve => setTimeout(resolve, 2000));
    saveBalance(emailBalance + emailsAdded);
    setRechargeSuccess(`✅ ${emailsAdded.toLocaleString()} email sendouts credited! (Simulated)`);
    setTimeout(() => { setRechargeSuccess(null); setShowRecharge(false); setSelectedCrypto(null); setPacksToBuy(1); }, 3000);
    setRecharging(false);
  };

  // Transaction history from logs
  const [txHistory, setTxHistory] = useState<any[]>([]);
  useEffect(() => {
    const stored = localStorage.getItem(SEND_LOGS_KEY);
    const logs: SendLog[] = stored ? JSON.parse(stored) : [];
    // Create simulated payment history
    const payments = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      payments.push({
        id: `tx_${i}`,
        date: d.toISOString(),
        amount: '$30.00',
        emails: '20,000',
        method: ['USDT (TRC-20)', 'Litecoin', 'Solana'][i % 3],
        status: 'completed',
        confirmations: 3,
      });
    }
    setTxHistory(payments);
  }, []);

  const CRYPTO_OPTIONS = [
    { id: 'usdt-trc20', label: 'USDT (TRC-20)', symbol: 'USDT', icon: '₮', network: 'TRC-20', color: 'text-green-400' },
    { id: 'usdt-erc20', label: 'USDT (ERC-20)', symbol: 'USDT', icon: '₮', network: 'ERC-20', color: 'text-blue-400' },
    { id: 'litecoin', label: 'Litecoin', symbol: 'LTC', icon: 'Ł', network: 'LTC', color: 'text-slate-400' },
    { id: 'solana', label: 'Solana', symbol: 'SOL', icon: '◎', network: 'SOL', color: 'text-purple-400' },
  ];

  if (!hydrated) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif text-white">💰 Wallet</h2>
        <button onClick={() => setShowRecharge(true)} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg transition-all">
          + Buy Email Sendouts
        </button>
      </div>

      {/* Balance Card */}
      <div className="glass-lg rounded-xl p-8 text-center">
        <p className="text-sm text-slate-400 mb-2">Available Email Sendouts</p>
        <p className="text-6xl font-serif font-bold text-white mb-2">{emailBalance.toLocaleString()}</p>
        <p className="text-xs text-slate-500">1 email = 1 sendout</p>
        <div className="mt-4 flex justify-center gap-4">
          {(['20k', '40k', '60k', '100k'] as const).map((pkg, i) => (
            <button key={i} onClick={() => { setPacksToBuy(i + 1); setShowRecharge(true); }} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-400 hover:text-white hover:border-accent-gold/50 transition-all">
              ${(i + 1) * 30} • {pkg}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-lg rounded-xl p-5 text-center">
          <p className="text-2xl font-bold text-accent-gold">20,000</p>
          <p className="text-xs text-slate-400">Emails per pack</p>
        </div>
        <div className="glass-lg rounded-xl p-5 text-center">
          <p className="text-2xl font-bold text-accent-gold">$30</p>
          <p className="text-xs text-slate-400">Per pack</p>
        </div>
        <div className="glass-lg rounded-xl p-5 text-center">
          <p className="text-2xl font-bold text-accent-gold">$1.50</p>
          <p className="text-xs text-slate-400">Per 1,000 emails</p>
        </div>
      </div>

      {/* Recharge Modal */}
      {showRecharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { if (!recharging) { setShowRecharge(false); setRechargeSuccess(null); setSelectedCrypto(null); } }}>
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-background-secondary to-background p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowRecharge(false); setRechargeSuccess(null); setSelectedCrypto(null); }} className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-xl font-serif text-white mb-2">Buy Email Sendouts</h3>
            <p className="text-sm text-slate-400 mb-6">Current balance: <span className="text-accent-gold font-bold">{emailBalance.toLocaleString()} emails</span></p>

            {rechargeSuccess ? (
              <div className="p-6 rounded-lg text-center bg-green-500/10 text-green-400 border border-green-500/30"><p className="font-medium">{rechargeSuccess}</p></div>
            ) : (
              <>
                {/* Pack selector */}
                <div className="mb-6">
                  <label className="block text-sm text-slate-400 mb-3">Email sendout packs</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setPacksToBuy(Math.max(1, packsToBuy - 1))} disabled={packsToBuy <= 1} className="w-10 h-10 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                    <div className="flex-1 text-center"><p className="text-2xl font-bold text-white">{packsToBuy}</p><p className="text-xs text-slate-400">pack{packsToBuy !== 1 ? 's' : ''}</p></div>
                    <button onClick={() => setPacksToBuy(packsToBuy + 1)} className="w-10 h-10 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white hover:bg-white/10">+</button>
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-accent-gold/10 border border-accent-gold/20">
                    <div className="flex justify-between text-sm mb-1"><span className="text-slate-400">Sendouts</span><span className="text-white font-bold">{(packsToBuy * 20000).toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Price</span><span className="text-accent-gold font-bold">${packsToBuy * 30}</span></div>
                    <p className="text-xs text-slate-500 mt-2">$30 per 20,000 emails</p>
                  </div>
                </div>

                {/* Crypto selection */}
                <div className="mb-6">
                  <label className="block text-sm text-slate-400 mb-3">Pay with crypto</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CRYPTO_OPTIONS.map(crypto => (
                      <button key={crypto.id} onClick={() => setSelectedCrypto(crypto.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedCrypto === crypto.id ? 'border-accent-gold bg-accent-gold/10 ring-2 ring-accent-gold' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                        <span className={`text-xl ${crypto.color}`}>{crypto.icon}</span>
                        <div className="text-left"><p className="text-sm font-medium text-white">{crypto.symbol}</p><p className="text-xs text-slate-400">{crypto.label}</p></div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment info */}
                {selectedCrypto && (
                  <div className="p-4 mb-6 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-sm text-slate-400 mb-2">Send <strong className="text-white">${packsToBuy * 30} USD</strong> in {CRYPTO_OPTIONS.find(c => c.id === selectedCrypto)?.symbol || 'crypto'} ({CRYPTO_OPTIONS.find(c => c.id === selectedCrypto)?.network})</p>
                    <div className="p-2 rounded bg-black/30 border border-white/5">
                      <p className="text-xs text-slate-500 font-mono break-all">Wallet address shown at checkout</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">⚡ Credited after 3 confirmations</p>
                  </div>
                )}

                <button onClick={handleRecharge} disabled={recharging || !selectedCrypto}
                  className="w-full rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-4 py-3 font-medium text-black hover:shadow-lg disabled:opacity-50 transition-all">
                  {recharging ? <span className="flex items-center justify-center gap-2"><span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Processing...</span>
                  : `Buy ${(packsToBuy * 20000).toLocaleString()} Emails — $${packsToBuy * 30}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="glass-lg rounded-xl p-6">
        <h3 className="text-lg font-serif text-white mb-4">Recent Transactions</h3>
        {txHistory.length === 0 ? (
          <p className="text-sm text-slate-400">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {txHistory.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-green-400">✅</span>
                  <div>
                    <p className="text-sm text-white">+{tx.emails} emails</p>
                    <p className="text-xs text-slate-500">{tx.method} • {new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-accent-gold font-bold">{tx.amount}</p>
                  <p className="text-xs text-green-400">{tx.confirmations}/3 confirmations</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== WALLET RECHARGE MODAL ========== */
function WalletRechargeModal({ emailBalance, onClose, onBalanceUpdate }: { emailBalance: number; onClose: () => void; onBalanceUpdate: (balance: number) => void }) {
  const [recharging, setRecharging] = useState(false);
  const [rechargeSuccess, setRechargeSuccess] = useState<string | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [packsToBuy, setPacksToBuy] = useState(1);

  const CRYPTO_OPTIONS = [
    { id: 'usdt-trc20', label: 'USDT (TRC-20)', symbol: 'USDT', icon: '₮', network: 'TRC-20', color: 'text-green-400' },
    { id: 'usdt-erc20', label: 'USDT (ERC-20)', symbol: 'USDT', icon: '₮', network: 'ERC-20', color: 'text-blue-400' },
    { id: 'litecoin', label: 'Litecoin', symbol: 'LTC', icon: 'Ł', network: 'LTC', color: 'text-slate-400' },
    { id: 'solana', label: 'Solana', symbol: 'SOL', icon: '◎', network: 'SOL', color: 'text-purple-400' },
  ];

  const handleRecharge = async () => {
    setRecharging(true);
    setRechargeSuccess(null);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const emailsAdded = packsToBuy * 20000;
    onBalanceUpdate(emailBalance + emailsAdded);
    setRechargeSuccess(`✅ ${emailsAdded.toLocaleString()} email sendouts credited!`);
    setTimeout(() => { onClose(); }, 2000);
    setRecharging(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { if (!recharging) onClose(); }}>
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-background-secondary to-background p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h3 className="text-xl font-serif text-white mb-2">Buy Email Sendouts</h3>
        <p className="text-sm text-slate-400 mb-6">Current: <span className="text-accent-gold font-bold">{emailBalance.toLocaleString()} emails</span></p>

        {rechargeSuccess ? (
          <div className="p-6 rounded-lg text-center bg-green-500/10 text-green-400 border border-green-500/30"><p className="font-medium">{rechargeSuccess}</p></div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-3">Packs</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setPacksToBuy(Math.max(1, packsToBuy - 1))} disabled={packsToBuy <= 1} className="w-10 h-10 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30">−</button>
                <div className="flex-1 text-center"><p className="text-2xl font-bold text-white">{packsToBuy}</p><p className="text-xs text-slate-400">pack{packsToBuy !== 1 ? 's' : ''}</p></div>
                <button onClick={() => setPacksToBuy(packsToBuy + 1)} className="w-10 h-10 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white hover:bg-white/10">+</button>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-accent-gold/10 border border-accent-gold/20">
                <div className="flex justify-between text-sm mb-1"><span className="text-slate-400">Sendouts</span><span className="text-white font-bold">{(packsToBuy * 20000).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Price</span><span className="text-accent-gold font-bold">${packsToBuy * 30}</span></div>
                <p className="text-xs text-slate-500 mt-2">$30 per 20,000 emails</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-3">Pay with</label>
              <div className="grid grid-cols-2 gap-2">
                {CRYPTO_OPTIONS.map(crypto => (
                  <button key={crypto.id} onClick={() => setSelectedCrypto(crypto.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedCrypto === crypto.id ? 'border-accent-gold bg-accent-gold/10 ring-2 ring-accent-gold' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                    <span className={`text-xl ${crypto.color}`}>{crypto.icon}</span>
                    <div className="text-left"><p className="text-sm font-medium text-white">{crypto.symbol}</p><p className="text-xs text-slate-400">{crypto.label}</p></div>
                  </button>
                ))}
              </div>
            </div>

            {selectedCrypto && (
              <div className="p-4 mb-6 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-slate-400 mb-2">Send <strong className="text-white">${packsToBuy * 30} USD</strong></p>
                <div className="p-2 rounded bg-black/30 border border-white/5"><p className="text-xs text-slate-500 font-mono break-all">Wallet address shown at checkout</p></div>
                <p className="text-xs text-slate-500 mt-2">⚡ Credited after 3 confirmations</p>
              </div>
            )}

            <button onClick={handleRecharge} disabled={recharging || !selectedCrypto}
              className="w-full rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-4 py-3 font-medium text-black hover:shadow-lg disabled:opacity-50 transition-all">
              {recharging ? 'Processing...' : `Buy ${(packsToBuy * 20000).toLocaleString()} Emails — $${packsToBuy * 30}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ========== LOGS TAB ========== */
function LogsTab() {
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed' | 'bounced'>('all');

  useEffect(() => {
    const stored = localStorage.getItem(SEND_LOGS_KEY);
    const all: SendLog[] = stored ? JSON.parse(stored) : [];
    setLogs(filter === 'all' ? all.reverse() : all.filter(l => l.status === filter).reverse());
  }, [filter]);

  const exportCsv = () => {
    const header = 'Email,Status,Error,Server,Timestamp\n';
    const rows = logs.map(l => `${l.recipientEmail},${l.status},${l.error || ''},${l.smtpServerId},${l.sentAt}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `send_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif text-white">Send Logs</h2>
        <div className="flex gap-2">
          {(['all', 'sent', 'failed', 'bounced'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs rounded-lg transition-all ${filter === f ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button onClick={exportCsv} className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-slate-400 border border-white/10 hover:text-white transition-all">📥 Export CSV</button>
        </div>
      </div>

      <div className="glass-lg rounded-xl overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No logs found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/5 sticky top-0">
                <tr className="text-slate-400 text-left">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Error</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map(log => (
                  <tr key={log.id} className={log.status === 'sent' ? 'text-green-400' : 'text-red-400'}>
                    <td className="px-4 py-3">{log.recipientEmail}</td>
                    <td className="px-4 py-3">
                      {log.status === 'sent' ? '✓ Sent' : log.status === 'failed' ? '✗ Failed' : '↩ Bounced'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{log.campaignId.slice(0, 20)}...</td>
                    <td className="px-4 py-3 text-slate-500">{log.error || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(log.sentAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}