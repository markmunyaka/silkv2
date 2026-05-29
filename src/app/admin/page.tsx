'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  AdminUser,
  AdminFileRecord,
  SystemMetrics,
  SystemLogEntry,
  SystemActionResponse,
  PaginatedResponse,
  UserRole,
  AccountStatus,
} from '@/types/admin';

type AdminTab = 'users' | 'system' | 'files';

interface ModalState {
  open: boolean;
  type: 'edit-user' | 'delete-user' | '';
  data?: Record<string, unknown>;
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    processing: 'bg-accent-neon-blue/20 text-accent-neon-blue border-accent-neon-blue/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    queued: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };
  return styles[status] || 'bg-white/10 text-foreground-secondary border-white/20';
};

const roleBadge = (role: string) => {
  const styles: Record<string, string> = {
    admin: 'bg-accent-gold/20 text-accent-gold border-accent-gold/30',
    standard: 'bg-white/10 text-foreground-secondary border-white/20',
  };
  return styles[role] || 'bg-white/10 text-foreground-secondary border-white/20';
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// =========================================================================
// MAIN
// =========================================================================
export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [liveTime, setLiveTime] = useState('');

  useEffect(() => {
    const tick = () => setLiveTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Quick Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <QuickStatCard label="Total Users" value="—" icon="👥" color="accent-gold" />
        <QuickStatCard label="Files Processed" value="—" icon="📄" color="accent-neon-blue" />
        <QuickStatCard label="Videos Generated" value="—" icon="🎬" color="emerald" />
        <QuickStatCard label="System Uptime" value="—" icon="🟢" color="emerald" />
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
        {([
          { key: 'users' as const, label: '👥 User Management' },
          { key: 'system' as const, label: '📊 System & AI Monitor' },
          { key: 'files' as const, label: '📁 Files & Documents' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-accent-gold/20 to-accent-neon-blue/10 text-accent-gold border border-accent-gold/30 shadow-lg shadow-accent-gold/5'
                : 'text-foreground-secondary hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span className="text-[10px] text-foreground-secondary/40 ml-2 mr-1">{liveTime}</span>
      </div>

      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'system' && <SystemTab />}
      {activeTab === 'files' && <FilesTab />}
    </div>
  );
}

function QuickStatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const borderColors: Record<string, string> = { 'accent-neon-blue': 'border-accent-neon-blue/20', 'accent-gold': 'border-accent-gold/20', emerald: 'border-emerald-500/20' };
  const gradientColors: Record<string, string> = { 'accent-neon-blue': 'from-accent-neon-blue/20 to-accent-neon-blue/5', 'accent-gold': 'from-accent-gold/20 to-accent-gold/5', emerald: 'from-emerald-500/20 to-emerald-500/5' };
  return (
    <div className={`glass-lg p-4 rounded-xl border ${borderColors[color] || 'border-white/10'} relative overflow-hidden group transition-all duration-300 hover:shadow-xl`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientColors[color] || 'from-white/5 to-transparent'} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative z-10 flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-xl font-serif font-bold text-white">{value}</p>
          <p className="text-[10px] text-foreground-secondary">{label}</p>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// USERS TAB
// =========================================================================
function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ open: false, type: '' });

  const pageSize = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (roleFilter) params.set('role', roleFilter);
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      if (json.ok) {
        const data = json.data as PaginatedResponse<AdminUser>;
        setUsers(data.items);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleUpdateUser = async (userId: string, updates: { role?: UserRole; status?: AccountStatus; credits?: number }) => {
    const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, ...updates }) });
    const json = await res.json();
    if (json.ok) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updates } : u)));
      setModal({ open: false, type: '' });
    } else {
      alert(json.error || 'Update failed');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const res = await fetch(`/api/admin/users?userId=${userId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setTotal((t) => t - 1);
      setModal({ open: false, type: '' });
    } else {
      alert(json.error || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif text-white mb-1">User & Account Management</h1>
        <p className="text-foreground-secondary text-sm">View, edit roles, toggle status, and manage user accounts</p>
      </div>

      <div className="glass-lg rounded-xl border border-white/5 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary text-sm">🔍</span>
            <input type="text" placeholder="Search by name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9 pr-4 py-2 text-sm w-full" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="text-sm py-2 px-3 min-w-[130px]">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="text-sm py-2 px-3 min-w-[130px]">
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="standard">Standard</option>
          </select>
          <span className="text-xs text-foreground-secondary whitespace-nowrap">{total} user{total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="glass-lg rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">User</th>
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">Email</th>
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">Role</th>
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">Status</th>
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">Credits</th>
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">Files</th>
                <th className="text-right px-5 py-4 text-foreground-secondary font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-foreground-secondary">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-foreground-secondary">
                  <span className="text-3xl block mb-3">👥</span>
                  No users found
                </td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-xs font-bold text-black shrink-0">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-white font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-foreground-secondary">{user.email}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full border ${roleBadge(user.role)}`}>{user.role}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${statusBadge(user.status)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {user.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-foreground-secondary font-mono">{user.credits}</td>
                    <td className="px-5 py-4 text-foreground-secondary">{user.fileCount}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setModal({ open: true, type: 'edit-user', data: { user } })} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-gold/20 text-accent-gold border border-accent-gold/30 hover:bg-accent-gold/30 transition-all">Edit</button>
                        <button onClick={() => setModal({ open: true, type: 'delete-user', data: { user } })} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > pageSize && (
          <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-foreground-secondary">Page {page} of {Math.ceil(total / pageSize)}</p>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-foreground-secondary hover:text-white disabled:opacity-40 transition-all">← Previous</button>
              <button disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-foreground-secondary hover:text-white disabled:opacity-40 transition-all">Next →</button>
            </div>
          </div>
        )}
      </div>

      {modal.open && modal.type === 'edit-user' && modal.data && (
        <EditUserModal user={modal.data.user as AdminUser} onSave={(updates) => handleUpdateUser((modal.data!.user as AdminUser).id, updates)} onClose={() => setModal({ open: false, type: '' })} />
      )}
      {modal.open && modal.type === 'delete-user' && modal.data && (
        <DeleteUserModal user={modal.data.user as AdminUser} onConfirm={() => handleDeleteUser((modal.data!.user as AdminUser).id)} onClose={() => setModal({ open: false, type: '' })} />
      )}
    </div>
  );
}

function EditUserModal({ user, onSave, onClose }: { user: AdminUser; onSave: (updates: { role?: UserRole; status?: AccountStatus; credits?: number }) => void; onClose: () => void }) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState<AccountStatus>(user.status);
  const [credits, setCredits] = useState(user.credits);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass-lg rounded-2xl border border-white/10 p-8 w-full max-w-lg mx-4 animate-fade-in-up shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif text-white">Edit User</h3>
          <button onClick={onClose} className="text-foreground-secondary hover:text-white text-lg">✕</button>
        </div>
        <div className="flex items-center gap-4 mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-sm font-bold text-black">{user.name.split(' ').map(n => n[0]).join('')}</div>
          <div>
            <p className="text-white font-medium">{user.name}</p>
            <p className="text-foreground-secondary text-xs">{user.email}</p>
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <label className="block text-sm text-foreground-secondary mb-2">Role</label>
            <div className="flex gap-2">
              {(['standard', 'admin'] as UserRole[]).map((r) => (
                <button key={r} onClick={() => setRole(r)} className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition-all ${role === r ? 'bg-accent-gold/20 text-accent-gold border-accent-gold/40 shadow-lg shadow-accent-gold/10' : 'bg-white/5 text-foreground-secondary border-white/10 hover:text-white'}`}>{r}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-foreground-secondary mb-2">Account Status</label>
            <div className="flex gap-2">
              {(['active', 'suspended'] as AccountStatus[]).map((s) => (
                <button key={s} onClick={() => setStatus(s)} className={`flex-1 py-2.5 text-sm font-medium rounded-lg border transition-all ${status === s ? (s === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/10' : 'bg-red-500/20 text-red-400 border-red-500/40 shadow-lg shadow-red-500/10') : 'bg-white/5 text-foreground-secondary border-white/10 hover:text-white'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-foreground-secondary mb-2">Credits</label>
            <input type="number" min={0} value={credits} onChange={(e) => setCredits(Math.max(0, parseInt(e.target.value) || 0))} className="w-full py-2.5 px-4 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-white/5">
          <button onClick={onClose} className="px-5 py-2.5 text-sm rounded-lg border border-white/10 text-foreground-secondary hover:text-white transition-all">Cancel</button>
          <button onClick={() => onSave({ role, status, credits })} className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-xl hover:shadow-accent-gold/40 transition-all">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function DeleteUserModal({ user, onConfirm, onClose }: { user: AdminUser; onConfirm: () => void; onClose: () => void }) {
  const [confirmText, setConfirmText] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass-lg rounded-2xl border border-red-500/20 p-8 w-full max-w-md mx-4 animate-fade-in-up shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-xl font-serif text-white mb-2">Delete User Account</h3>
          <p className="text-foreground-secondary text-sm">This will permanently delete <strong className="text-white">{user.name}</strong> ({user.email}) and all associated data.</p>
        </div>
        <div className="mb-6">
          <label className="block text-xs text-foreground-secondary mb-2">Type <strong className="text-red-400">DELETE</strong> to confirm</label>
          <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE to confirm" className="w-full py-2.5 px-4 text-sm text-center" />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="flex-1 px-5 py-2.5 text-sm rounded-lg border border-white/10 text-foreground-secondary hover:text-white transition-all">Cancel</button>
          <button disabled={confirmText !== 'DELETE'} onClick={onConfirm} className="flex-1 px-5 py-2.5 text-sm font-semibold rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Permanently Delete</button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// SYSTEM TAB
// =========================================================================
function SystemTab() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionResult, setActionResult] = useState<SystemActionResponse | null>(null);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  const fetchSystem = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system');
      const json = await res.json();
      if (json.ok) {
        setMetrics(json.data.metrics);
        setLogs(json.data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch system data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSystem(); }, [fetchSystem]);

  const handleAction = async (action: string) => {
    setExecutingAction(action);
    try {
      const res = await fetch('/api/admin/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const json = await res.json();
      if (json.ok) { setActionResult(json.data); setTimeout(() => setActionResult(null), 5000); }
      else { alert(json.error || 'Action failed'); }
    } catch (err) {
      console.error('Action failed', err);
    } finally {
      setExecutingAction(null);
    }
  };

  if (loading) return <div className="text-center py-16 text-foreground-secondary">Loading system data...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif text-white mb-1">System & AI Integration Monitor</h1>
        <p className="text-foreground-secondary text-sm">Real-time metrics, service status, and global controls</p>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="API Latency" value={`${metrics.apiLatencyMs}ms`} icon="⚡" color="accent-neon-blue" />
          <MetricCard label="LLM Tokens Today" value={metrics.llmTokensConsumed.toLocaleString()} icon="🧠" color="accent-gold" />
          <MetricCard label="Active Workers" value={String(metrics.activeWorkers)} icon="⚙️" color="emerald" />
          <MetricCard label="Uptime" value={`${metrics.uptimeHours}h`} icon="🟢" color="emerald" />
          <MetricCard label="Memory Usage" value={`${metrics.memoryUsageMb} MB`} icon="💾" color="accent-neon-blue" />
          <MetricCard label="Database Size" value={`${metrics.dbSizeMb} MB`} icon="🗄️" color="accent-gold" />
        </div>
      )}

      <div className="glass-lg rounded-xl border border-white/5 p-6">
        <h3 className="text-lg font-serif text-white mb-4">🛠️ Global System Controls</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { key: 'clear-cache', label: 'Clear System Cache', icon: '🧹', desc: 'Flush temporary files & in-memory stores' },
            { key: 'pause-queues', label: 'Pause Processing Queues', icon: '⏸️', desc: 'Stop background job processing' },
            { key: 'restart-workers', label: 'Restart Workers', icon: '🔄', desc: 'Restart all background worker processes' },
          ] as const).map((btn) => (
            <button key={btn.key} onClick={() => handleAction(btn.key)} disabled={executingAction === btn.key} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-accent-gold/30 hover:bg-white/10 transition-all disabled:opacity-50 text-left group">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{btn.icon}</span>
                <span className="text-sm font-medium text-white">{btn.label}</span>
              </div>
              <p className="text-xs text-foreground-secondary">{btn.desc}</p>
              {executingAction === btn.key && <span className="inline-block mt-2 text-xs text-accent-gold animate-pulse">Executing...</span>}
            </button>
          ))}
        </div>
        {actionResult && <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-400 animate-fade-in">✅ {actionResult.message}</div>}
      </div>

      <div className="glass-lg rounded-xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="text-lg font-serif text-white">📋 Recent System Log</h3>
        </div>
        <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="px-6 py-8 text-center text-foreground-secondary text-sm">No log entries yet.</div>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} className="px-6 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${entry.level === 'error' ? 'bg-red-400' : entry.level === 'warn' ? 'bg-amber-400' : entry.level === 'debug' ? 'bg-foreground-secondary' : 'bg-emerald-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-foreground-secondary">{entry.source}</span>
                      <span className="text-[10px] text-foreground-secondary/50">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-white truncate">{entry.message}</p>
                    {entry.details && <p className="text-xs text-foreground-secondary mt-0.5">{entry.details}</p>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const borderColors: Record<string, string> = { 'accent-neon-blue': 'border-accent-neon-blue/20', 'accent-gold': 'border-accent-gold/20', emerald: 'border-emerald-500/20' };
  const gradientColors: Record<string, string> = { 'accent-neon-blue': 'from-accent-neon-blue/20 to-accent-neon-blue/5', 'accent-gold': 'from-accent-gold/20 to-accent-gold/5', emerald: 'from-emerald-500/20 to-emerald-500/5' };
  return (
    <div className={`glass-lg p-5 rounded-xl border ${borderColors[color] || 'border-white/10'} hover:shadow-xl hover:shadow-accent-gold/10 transition-all duration-300 relative overflow-hidden group`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientColors[color] || 'from-white/5 to-transparent'} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2"><span className="text-2xl">{icon}</span></div>
        <p className="text-2xl font-serif font-bold text-white mb-0.5">{value}</p>
        <p className="text-xs text-foreground-secondary">{label}</p>
      </div>
    </div>
  );
}

// =========================================================================
// FILES TAB
// =========================================================================
function FilesTab() {
  const [files, setFiles] = useState<AdminFileRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        const res = await fetch(`/api/admin/files?${params}`);
        const json = await res.json();
        if (json.ok) {
          const data = json.data as PaginatedResponse<AdminFileRecord>;
          setFiles(data.items);
          setTotal(data.total);
        }
      } catch (err) {
        console.error('Failed to fetch files', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [page, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif text-white mb-1">Files & Documents</h1>
        <p className="text-foreground-secondary text-sm">Track all processed documents, formats, and owners</p>
      </div>

      <div className="glass-lg rounded-xl border border-white/5 p-5">
        <div className="relative max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary text-sm">🔍</span>
          <input type="text" placeholder="Search by file name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9 pr-4 py-2 text-sm w-full" />
        </div>
      </div>

      <div className="glass-lg rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">File Name</th>
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">Format</th>
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">Size</th>
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">Owner</th>
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">Status</th>
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">Video</th>
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-foreground-secondary">Loading...</td></tr>
              ) : files.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-foreground-secondary">
                  <span className="text-3xl block mb-3">📁</span>
                  No files processed yet
                </td></tr>
              ) : (
                files.map((file) => (
                  <tr key={file.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4"><div className="flex items-center gap-2"><span className="text-lg">📄</span><span className="text-white font-medium truncate max-w-[200px]">{file.fileName}</span></div></td>
                    <td className="px-5 py-4">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border ${file.format === 'PDF' ? 'bg-red-500/20 text-red-400 border-red-500/30' : file.format === 'Audio' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : file.format === 'Video' ? 'bg-accent-neon-blue/20 text-accent-neon-blue border-accent-neon-blue/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>{file.format}</span>
                    </td>
                    <td className="px-5 py-4 text-foreground-secondary font-mono">{formatBytes(file.sizeBytes)}</td>
                    <td className="px-5 py-4"><div className="text-white text-sm">{file.ownerName}</div><div className="text-foreground-secondary text-xs">{file.ownerEmail}</div></td>
                    <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${statusBadge(file.processingStatus)}`}>{file.processingStatus}</span></td>
                    <td className="px-5 py-4">{file.hasVideo ? <span className="text-emerald-400 text-xs font-medium">✅ Generated</span> : <span className="text-foreground-secondary text-xs">—</span>}</td>
                    <td className="px-5 py-4 text-foreground-secondary text-xs">{new Date(file.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > pageSize && (
          <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-foreground-secondary">Page {page} of {Math.ceil(total / pageSize)}</p>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-foreground-secondary hover:text-white disabled:opacity-40 transition-all">← Previous</button>
              <button disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-foreground-secondary hover:text-white disabled:opacity-40 transition-all">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}