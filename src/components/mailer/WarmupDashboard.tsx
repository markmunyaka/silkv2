'use client';

import { useState, useEffect, useCallback } from 'react';

interface WarmupInbox {
  id: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  status: string;
  dailySentCount: number;
  dailyLimit: number;
  warmupPhase: string;
  createdAt: string;
}

interface WarmupStats {
  inboxes: number;
  activeThreads: number;
  todaySent: number;
  inboxList: WarmupInbox[];
}

export default function WarmupDashboard() {
  const [stats, setStats] = useState<WarmupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [workerRunning, setWorkerRunning] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Inbox form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    email: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    imapHost: '',
    dailyLimit: '30',
  });
  const [saving, setSaving] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/mailer/warmup');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const doAction = async (action: string) => {
    setActionMsg(null);
    try {
      const res = await fetch('/api/mailer/warmup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg({ type: 'success', text: data.message || `Action "${action}" completed` });
        if (action === 'start') setWorkerRunning(true);
        if (action === 'stop') setWorkerRunning(false);
        if (action === 'cycle') {
          setWorkerRunning(true);
          await fetchStats();
        }
      } else {
        setActionMsg({ type: 'error', text: data.error || 'Action failed' });
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: 'Network error' });
    }
    setTimeout(() => setActionMsg(null), 5000);
  };

  const addInbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setActionMsg(null);
    try {
      const res = await fetch('/api/mailer/warmup/inboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          smtpHost: form.smtpHost,
          smtpPort: parseInt(form.smtpPort),
          smtpUser: form.smtpUser,
          smtpPass: form.smtpPass,
          imapHost: form.imapHost || form.smtpHost,
          dailyLimit: parseInt(form.dailyLimit),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg({ type: 'success', text: `Inbox ${form.email} registered!` });
        setShowAddForm(false);
        setForm({ email: '', smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', imapHost: '', dailyLimit: '30' });
        await fetchStats();
      } else {
        setActionMsg({ type: 'error', text: data.error || 'Failed to add inbox' });
      }
    } catch {
      setActionMsg({ type: 'error', text: 'Network error' });
    }
    setSaving(false);
    setTimeout(() => setActionMsg(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {actionMsg && (
        <div className={`p-4 rounded-lg border ${
          actionMsg.type === 'success'
            ? 'bg-green-900/30 border-green-500/50 text-green-300'
            : 'bg-red-900/30 border-red-500/50 text-red-300'
        }`}>
          {actionMsg.text}
        </div>
      )}

      {/* Controls */}
      <div className="glass-lg p-6 rounded-lg">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span>⚙️</span> Warmup Controls
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => doAction('cycle')}
            className="px-4 py-2 bg-accent-gold text-black font-bold rounded-lg hover:bg-accent-gold-light transition-all"
          >
            ▶ Run Cycle Now
          </button>
          <button
            onClick={() => doAction('start')}
            className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-all"
          >
            ▶ Start Worker
          </button>
          <button
            onClick={() => doAction('stop')}
            className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 transition-all"
          >
            ⏹ Stop Worker
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {!loading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-lg p-5 rounded-lg text-center">
            <p className="text-3xl font-bold text-accent-gold">{stats.inboxes}</p>
            <p className="text-sm text-foreground-secondary mt-1">Active Inboxes</p>
          </div>
          <div className="glass-lg p-5 rounded-lg text-center">
            <p className="text-3xl font-bold text-accent-neon-blue">{stats.activeThreads}</p>
            <p className="text-sm text-foreground-secondary mt-1">Active Threads</p>
          </div>
          <div className="glass-lg p-5 rounded-lg text-center">
            <p className="text-3xl font-bold text-white">{stats.todaySent}</p>
            <p className="text-sm text-foreground-secondary mt-1">Sent Today</p>
          </div>
        </div>
      )}

      {/* Inbox List */}
      <div className="glass-lg p-6 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <span>📬</span> Warmup Inboxes
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-accent-gold text-black font-bold rounded-lg text-sm hover:bg-accent-gold-light transition-all"
          >
            {showAddForm ? '✕ Cancel' : '+ Add Inbox'}
          </button>
        </div>

        {/* Add Inbox Form */}
        {showAddForm && (
          <form onSubmit={addInbox} className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                placeholder="Email *"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-gray-500"
                required
              />
              <input
                type="text"
                placeholder="SMTP Host *"
                value={form.smtpHost}
                onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-gray-500"
                required
              />
              <input
                type="number"
                placeholder="SMTP Port (587)"
                value={form.smtpPort}
                onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-gray-500"
              />
              <input
                type="text"
                placeholder="SMTP Username *"
                value={form.smtpUser}
                onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-gray-500"
                required
              />
              <input
                type="password"
                placeholder="SMTP Password *"
                value={form.smtpPass}
                onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-gray-500"
                required
              />
              <input
                type="text"
                placeholder="IMAP Host (default: same as SMTP)"
                value={form.imapHost}
                onChange={(e) => setForm({ ...form, imapHost: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-gray-500"
              />
              <input
                type="number"
                placeholder="Daily Limit (30)"
                value={form.dailyLimit}
                onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })}
                className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-gray-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent-gold text-black font-bold rounded-lg hover:bg-accent-gold-light transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Register Inbox'}
            </button>
          </form>
        )}

        {/* Inbox Table */}
        {stats && stats.inboxList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-foreground-secondary border-b border-white/10">
                  <th className="text-left py-2 pr-4">Email</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-left py-2 pr-4">Phase</th>
                  <th className="text-left py-2 pr-4">Today / Limit</th>
                  <th className="text-left py-2 pr-4">SMTP</th>
                </tr>
              </thead>
              <tbody>
                {stats.inboxList.map((inbox) => (
                  <tr key={inbox.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-4 text-white">{inbox.email}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        inbox.status === 'active' ? 'bg-green-900/50 text-green-300' :
                        inbox.status === 'error' ? 'bg-red-900/50 text-red-300' :
                        'bg-yellow-900/50 text-yellow-300'
                      }`}>
                        {inbox.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-foreground-secondary capitalize">{inbox.warmupPhase.replace('_', ' ')}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-white/10 rounded-full h-1.5">
                          <div
                            className="bg-gradient-to-r from-accent-gold to-accent-neon-blue h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, (inbox.dailySentCount / inbox.dailyLimit) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-foreground-secondary">{inbox.dailySentCount}/{inbox.dailyLimit}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-foreground-secondary text-xs">{inbox.smtpHost}:{inbox.smtpPort}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-foreground-secondary">
            <p className="text-3xl mb-2">📭</p>
            <p>No warmup inboxes yet. Add at least 2 to start warming up.</p>
          </div>
        )}
      </div>
    </div>
  );
}