'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AdminUser,
  PaginatedResponse,
  UserRole,
  AccountStatus,
} from '@/types/admin';

interface LocalStorageUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role?: string;
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
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

// Read localStorage users from the browser
function getLocalUsers(): AdminUser[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('users');
    if (!raw) return [];
    const users: LocalStorageUser[] = JSON.parse(raw);
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: (u.role as UserRole) || 'standard',
      status: 'active' as AccountStatus,
      credits: 2,
      isSubscribed: false,
      subscriptionPlan: null,
      fileCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

interface ModalState {
  open: boolean;
  type: 'edit-user' | 'delete-user' | 'view-user' | '';
  user?: AdminUser;
}

export default function AdminUsersPage() {
  const [dbUsers, setDbUsers] = useState<AdminUser[]>([]);
  const [localUsers, setLocalUsers] = useState<AdminUser[]>([]);
  const [dbTotal, setDbTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ open: false, type: '' });

  const pageSize = 50;

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
        setDbUsers(data.items);
        setDbTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch db users', err);
    }

    // Also get users from localStorage (main app signup users)
    setLocalUsers(getLocalUsers());
    setLoading(false);
  }, [page, search, statusFilter, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Merge DB users + localStorage users, deduplicate by email
  const allUsers = (() => {
    const seen = new Set<string>();
    const merged: AdminUser[] = [];

    // DB users first (they have more complete data)
    for (const u of dbUsers) {
      seen.add(u.email.toLowerCase());
      merged.push(u);
    }

    // Then localStorage users (only if not already in DB)
    for (const u of localUsers) {
      if (!seen.has(u.email.toLowerCase())) {
        seen.add(u.email.toLowerCase());
        merged.push(u);
      }
    }

    return merged;
  })();

  const handleDeleteUser = async (userId: string) => {
    const res = await fetch(`/api/admin/users?userId=${userId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.ok) {
      setDbUsers((prev) => prev.filter((u) => u.id !== userId));
      setModal({ open: false, type: '' });
    } else {
      alert(json.error || 'Delete failed');
    }
  };

  const handleUpdateUser = async (userId: string, updates: { role?: UserRole; status?: AccountStatus; credits?: number }) => {
    const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, ...updates }) });
    const json = await res.json();
    if (json.ok) {
      setDbUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updates } : u)));
      setModal({ open: false, type: '' });
    } else {
      alert(json.error || 'Update failed');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif text-white mb-1">User & Account Management</h1>
          <p className="text-foreground-secondary text-sm">
            {allUsers.length} user{allUsers.length !== 1 ? 's' : ''}
            {localUsers.length > 0 && dbUsers.length > 0 && (
              <span className="text-foreground-secondary/60 ml-2">
                ({dbUsers.length} DB + {localUsers.length} app users)
              </span>
            )}
          </p>
        </div>
        {localUsers.length > 0 && (
          <button
            onClick={async () => {
              if (confirm(`Import ${localUsers.length} app user(s) into the database? This will let you manage them fully.`)) {
                const raw = localStorage.getItem('users');
                if (raw) {
                  const users = JSON.parse(raw);
                  let imported = 0;
                  for (const u of users) {
                    try {
                      await fetch('/api/auth', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: u.email,
                          password: u.password || 'Imported@123',
                          name: u.name,
                        }),
                      });
                      imported++;
                    } catch {}
                  }
                  alert(`Imported ${imported} user(s) to database. Refreshing...`);
                  window.location.reload();
                }
              }
            }}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-accent-gold/20 text-accent-gold border border-accent-gold/30 hover:bg-accent-gold/30 transition-all"
          >
            🔄 Sync App Users to DB
          </button>
        )}
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
                <th className="text-left px-5 py-4 text-foreground-secondary font-medium">Source</th>
                <th className="text-right px-5 py-4 text-foreground-secondary font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-16 text-center text-foreground-secondary">Loading...</td></tr>
              ) : allUsers.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-16 text-center text-foreground-secondary">
                  <span className="text-3xl block mb-3">👥</span>
                  No users found. Users created through the main app signup will appear here.
                  {dbUsers.length === 0 && localUsers.length === 0 && (
                    <p className="text-xs text-foreground-secondary/60 mt-2">
                      Try signing up at <strong className="text-accent-gold">/auth/signup</strong> first.
                    </p>
                  )}
                </td></tr>
              ) : (
                allUsers.map((user) => {
                  const isLocal = localUsers.some((u) => u.email === user.email && !dbUsers.some((d) => d.email === user.email));
                  return (
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
                      <td className="px-5 py-4">
                        {isLocal ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">App</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-neon-blue/20 text-accent-neon-blue border border-accent-neon-blue/30">DB</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setModal({ open: true, type: 'view-user', user }); }} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-neon-blue/20 text-accent-neon-blue border border-accent-neon-blue/30 hover:bg-accent-neon-blue/30 transition-all">👁 View</button>
                          <button onClick={() => setModal({ open: true, type: 'edit-user', user })} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-gold/20 text-accent-gold border border-accent-gold/30 hover:bg-accent-gold/30 transition-all">Edit</button>
                          <button onClick={() => setModal({ open: true, type: 'delete-user', user })} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && modal.type === 'view-user' && modal.user && (
        <ViewUserModal userId={modal.user.id} onClose={() => setModal({ open: false, type: '' })} />
      )}
      {modal.open && modal.type === 'edit-user' && modal.user && (
        <EditUserModal user={modal.user} onSave={(updates) => handleUpdateUser(modal.user!.id, updates)} onClose={() => setModal({ open: false, type: '' })} />
      )}
      {modal.open && modal.type === 'delete-user' && modal.user && (
        <DeleteUserModal user={modal.user} onConfirm={() => handleDeleteUser(modal.user!.id)} onClose={() => setModal({ open: false, type: '' })} />
      )}
    </div>
  );
}

function ViewUserModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/impersonate?userId=${userId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) setData(json.data);
        else setData(null);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-lg rounded-2xl border border-white/10 p-8 w-full max-w-3xl mx-4 animate-fade-in-up shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👁️</span>
            <h3 className="text-xl font-serif text-white">God Mode — User Dashboard</h3>
          </div>
          <button onClick={onClose} className="text-foreground-secondary hover:text-white text-lg">✕</button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-foreground-secondary">Loading user data...</div>
        ) : !data ? (
          <div className="text-center py-12 text-foreground-secondary">Could not load user data. User may not exist in database.</div>
        ) : (
          <div className="space-y-6">
            {/* User info */}
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-lg font-bold text-black">
                {data.user.name.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div className="flex-1">
                <p className="text-lg text-white font-medium">{data.user.name}</p>
                <p className="text-foreground-secondary text-sm">{data.user.email}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${data.user.role === 'admin' ? 'bg-accent-gold/20 text-accent-gold border-accent-gold/30' : 'bg-white/10 text-foreground-secondary border-white/20'}`}>{data.user.role}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${data.user.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{data.user.status}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-neon-blue/20 text-accent-neon-blue border border-accent-neon-blue/30">{data.user.credits} credits</span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-2xl font-serif font-bold text-accent-gold">{data.stats.totalFiles}</p>
                <p className="text-xs text-foreground-secondary mt-1">Files</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-2xl font-serif font-bold text-accent-neon-blue">{data.stats.totalVideos}</p>
                <p className="text-xs text-foreground-secondary mt-1">Videos</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-2xl font-serif font-bold text-emerald-400">{data.stats.totalCampaigns}</p>
                <p className="text-xs text-foreground-secondary mt-1">Campaigns</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-2xl font-serif font-bold text-purple-400">{data.stats.totalLeads}</p>
                <p className="text-xs text-foreground-secondary mt-1">Leads</p>
              </div>
            </div>

            {/* Recent files */}
            <div>
              <h4 className="text-sm font-medium text-white mb-3">📄 Recent Files</h4>
              {data.recentFiles.length === 0 ? (
                <p className="text-xs text-foreground-secondary">No files yet</p>
              ) : (
                <div className="space-y-2">
                  {data.recentFiles.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">📄</span>
                        <span className="text-sm text-white truncate">{f.fileName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {f.hasVideo && <span className="text-[10px] text-emerald-400">🎬</span>}
                        <span className="text-[10px] text-foreground-secondary">{new Date(f.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent videos */}
            <div>
              <h4 className="text-sm font-medium text-white mb-3">🎬 Recent Videos</h4>
              {data.recentVideos.length === 0 ? (
                <p className="text-xs text-foreground-secondary">No videos yet</p>
              ) : (
                <div className="space-y-2">
                  {data.recentVideos.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${v.status === 'succeeded' ? 'text-emerald-400' : v.status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}>
                          {v.status === 'succeeded' ? '✅' : v.status === 'failed' ? '❌' : '⏳'}
                        </span>
                        <span className="text-sm text-foreground-secondary">Task: {v.taskId.slice(0, 20)}...</span>
                      </div>
                      <span className="text-[10px] text-foreground-secondary">{v.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subscription info */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground-secondary">Subscription</p>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${data.user.isSubscribed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/10 text-foreground-secondary border border-white/20'}`}>
                  {data.user.isSubscribed ? `Pro — ${data.user.subscriptionPlan || 'Active'}` : 'Free'}
                </span>
              </div>
              {data.user.violationReason && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-xs text-red-400">🚫 Violation: {data.user.violationReason}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end mt-6 pt-4 border-t border-white/5">
          <button onClick={onClose} className="px-5 py-2 text-sm rounded-lg border border-white/10 text-foreground-secondary hover:text-white transition-all">Close</button>
        </div>
      </div>
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
          <div><p className="text-white font-medium">{user.name}</p><p className="text-foreground-secondary text-xs">{user.email}</p></div>
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