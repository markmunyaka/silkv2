'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Navigation } from '@/components/Navigation';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validate passwords
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // Call password change API
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to change password');
      }

      setSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-background via-background-secondary to-background pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-serif text-white mb-2">Account Settings</h1>
          <p className="text-foreground-secondary mb-8">Manage your account preferences and security</p>

          {/* User Info Section */}
          <div className="glass-lg p-8 mb-6 animate-fade-in-up">
            <h2 className="text-xl font-serif text-white mb-4">Profile Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-foreground-secondary text-sm mb-1">Name</label>
                <p className="text-white">{user?.name}</p>
              </div>
              <div>
                <label className="block text-foreground-secondary text-sm mb-1">Email</label>
                <p className="text-white">{user?.email}</p>
              </div>
              <div>
                <label className="block text-foreground-secondary text-sm mb-1">Account Created</label>
                <p className="text-white">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Change Password Section */}
          <div className="glass-lg p-8 mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-xl font-serif text-white mb-4">Change Password</h2>

            {error && (
              <div className="mb-6 p-4 bg-red-950/80 border border-red-700/50 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-950/80 border border-green-700/50 rounded-lg">
                <p className="text-green-300 text-sm">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Current Password */}
              <div>
                <label htmlFor="currentPassword" className="block text-foreground-secondary text-sm font-medium mb-2">
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 transition-all focus:bg-white/8 focus:border-accent-neon-blue focus:outline-none focus:shadow-lg focus:shadow-accent-neon-blue/20"
                  required
                  disabled={loading}
                />
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="newPassword" className="block text-foreground-secondary text-sm font-medium mb-2">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 transition-all focus:bg-white/8 focus:border-accent-neon-blue focus:outline-none focus:shadow-lg focus:shadow-accent-neon-blue/20"
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>

              {/* Confirm New Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-foreground-secondary text-sm font-medium mb-2">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 transition-all focus:bg-white/8 focus:border-accent-neon-blue focus:outline-none focus:shadow-lg focus:shadow-accent-neon-blue/20"
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-bold py-3 rounded-lg transition-all hover:shadow-xl hover:shadow-accent-gold/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </div>

          {/* Security Section */}
          <div className="glass-lg p-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-xl font-serif text-white mb-4">Security</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-foreground-secondary text-sm">Password protected</span>
                <span className="text-accent-gold text-sm">Enabled</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-foreground-secondary text-sm">Two-factor authentication</span>
                <button className="text-accent-gold text-sm hover:text-accent-gold-light transition-colors">
                  Configure
                </button>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-foreground-secondary text-sm">Login notifications</span>
                <span className="text-accent-gold text-sm">Enabled</span>
              </div>
            </div>
          </div>

          {/* Log Out Section */}
          <div className="glass-lg p-8 mb-6 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
            <h2 className="text-xl font-serif text-white mb-4">Session</h2>
            <p className="text-foreground-secondary text-sm mb-4">Sign out of your account on this device.</p>
            <button
              onClick={() => {
                logout();
                router.push('/auth/login');
              }}
              className="w-full bg-white/10 border border-white/20 text-white font-medium py-3 rounded-lg transition-all hover:bg-white/15 hover:border-white/30"
            >
              Log Out
            </button>
          </div>

          {/* Delete Account Section */}
          <div className="glass-lg p-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <h2 className="text-xl font-serif text-red-400 mb-2">Delete Account</h2>
            <p className="text-foreground-secondary text-sm mb-6">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-red-600/20 border border-red-600/40 text-red-400 font-medium py-3 rounded-lg transition-all hover:bg-red-600/30 hover:border-red-600/60"
              >
                Delete My Account
              </button>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-red-950/80 border border-red-700/50 rounded-lg">
                  <p className="text-red-300 text-sm font-medium mb-2">⚠️ Are you absolutely sure?</p>
                  <p className="text-red-400/70 text-xs">
                    This will permanently delete your account, your files, campaigns, and all related data.
                    You will not be able to recover anything.
                  </p>
                </div>

                {deleteError && (
                  <div className="p-4 bg-red-950/80 border border-red-700/50 rounded-lg">
                    <p className="text-red-300 text-sm">{deleteError}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="deleteConfirm" className="block text-foreground-secondary text-sm font-medium mb-2">
                    Type <span className="text-red-400 font-bold">DELETE</span> to confirm
                  </label>
                  <input
                    id="deleteConfirm"
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder='Type "DELETE" to confirm'
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 transition-all focus:bg-white/8 focus:border-red-500 focus:outline-none focus:shadow-lg focus:shadow-red-500/20"
                    disabled={deleting}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                      setDeleteError('');
                    }}
                    disabled={deleting}
                    className="flex-1 bg-white/10 border border-white/20 text-white font-medium py-3 rounded-lg transition-all hover:bg-white/15 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (deleteConfirmText !== 'DELETE') return;
                      setDeleteError('');
                      setDeleting(true);
                      try {
                        const res = await fetch('/api/auth/delete', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: user?.id }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          throw new Error(data.error || 'Failed to delete account');
                        }
                        logout();
                        router.push('/auth/login');
                      } catch (err: any) {
                        setDeleteError(err.message || 'An error occurred');
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    disabled={deleteConfirmText !== 'DELETE' || deleting}
                    className="flex-1 bg-red-600 text-white font-bold py-3 rounded-lg transition-all hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Deleting...' : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-accent-gold hover:text-accent-gold-light transition-colors underline text-sm"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
