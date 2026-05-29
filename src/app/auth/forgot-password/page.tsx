'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    // Basic email validation
    if (!email.trim()) {
      setMessage('Please enter your email address');
      setIsError(true);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send reset email');
      }

      setMessage(data.message || 'Password reset email sent! Check your inbox.');
      router.push('/auth/reset-password');
    } catch (err: any) {
      setIsError(true);
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background-secondary to-background flex items-center justify-center px-4 pt-20">
      <div className="w-full max-w-md">
        <div className="glass-lg p-8 md:p-10 animate-fade-in-up">
          <h2 className="text-3xl font-serif text-white mb-2">Forgot Password</h2>
          <p className="text-foreground-secondary mb-8 text-sm">
            Enter your email address and we&apos;ll send you a link to reset your password
          </p>

          {isError && (
            <div className="mb-6 p-4 bg-red-950/80 border border-red-700/50 rounded-lg">
              <p className="text-red-300 text-sm">{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 mb-8">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-foreground-secondary text-sm font-medium mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 transition-all focus:bg-white/8 focus:border-accent-neon-blue focus:outline-none focus:shadow-lg focus:shadow-accent-neon-blue/20"
                required
                disabled={loading}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-bold py-3 rounded-lg transition-all hover:shadow-xl hover:shadow-accent-neon-blue/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          {message && (
            <div className="text-center mt-8">
              <p className="text-sm text-foreground-secondary">{message}</p>
              <a
                href="/auth/login"
                className="text-accent-gold hover:text-accent-gold-light transition-colors underline"
              >
                Back to Login
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}