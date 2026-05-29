'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background-secondary to-background flex items-center justify-center px-4 pt-20">
        <div className="w-full max-w-md">
          <div className="glass-lg p-8 md:p-10 animate-fade-in-up text-center">
            <h2 className="text-2xl font-serif text-white mb-4">Invalid Reset Link</h2>
            <p className="text-foreground-secondary mb-6">
              This password reset link is invalid or has expired.
            </p>
            <a
              href="/auth/login"
              className="inline-block bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-bold py-3 px-6 rounded-lg hover:shadow-xl hover:shadow-accent-gold/40 transition-all"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background-secondary to-background flex items-center justify-center px-4 pt-20">
        <div className="w-full max-w-md">
          <div className="glass-lg p-8 md:p-10 animate-fade-in-up text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-accent-gold" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </div>
            <h2 className="text-2xl font-serif text-white mb-4">Password Reset Complete!</h2>
            <p className="text-foreground-secondary mb-6">
              Your password has been successfully reset.
            </p>
            <p className="text-sm text-foreground-secondary mb-6">
              Redirecting you to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background-secondary to-background flex items-center justify-center px-4 pt-20">
      <div className="w-full max-w-md">
        <div className="glass-lg p-8 md:p-10 animate-fade-in-up">
          <h2 className="text-3xl font-serif text-white mb-2">Reset Password</h2>
          <p className="text-foreground-secondary mb-8 text-sm">Enter your new password</p>

          {error && (
            <div className="mb-6 p-4 bg-red-950/80 border border-red-700/50 rounded-lg">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-foreground-secondary text-sm font-medium mb-2">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 transition-all focus:bg-white/8 focus:border-accent-neon-blue focus:outline-none focus:shadow-lg focus:shadow-accent-neon-blue/20"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-foreground-secondary text-sm font-medium mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 transition-all focus:bg-white/8 focus:border-accent-neon-blue focus:outline-none focus:shadow-lg focus:shadow-accent-neon-blue/20"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-bold py-3 rounded-lg transition-all hover:shadow-xl hover:shadow-accent-gold/40 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <div className="text-center mt-6">
            <a
              href="/auth/login"
              className="text-accent-gold hover:text-accent-gold-light transition-colors text-sm"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}