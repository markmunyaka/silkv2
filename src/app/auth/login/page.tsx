'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Navigation } from '@/components/Navigation';

export default function LoginPage() {
  const router = useRouter();
  const { login, appleLogin, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Input validation
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);

    try {
      await login(email.toLowerCase(), password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    // TODO: Implement Google OAuth
    setError('Google login coming soon');
  };

  const handleAppleLogin = () => {
    // TODO: Implement Apple Sign In
    // In a real implementation, you would integrate with Apple's Sign In SDK
    // For now, this shows the integration point
    setError('Apple Sign In coming soon');
  };

  return (
    <>
      <Navigation />
      <main className="relative min-h-screen flex items-center justify-center px-4 pt-20 overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/auth-bg.jpg')" }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/80" />
        
        <div className="relative z-10 w-full max-w-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Branding */}
            <div className="hidden lg:block space-y-8">
              <div>
                <h1 className="text-5xl font-serif text-white mb-4 leading-tight">
                  Welcome Back
                </h1>
                <p className="text-xl text-foreground-secondary">
                  Access your document library and continue where you left off
                </p>
              </div>

              {/* Feature List */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-6 h-6 text-accent-gold" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-serif text-white text-lg">Secure Encryption</h3>
                    <p className="text-foreground-secondary text-sm">Your documents are encrypted end-to-end</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-6 h-6 text-accent-neon-blue" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-serif text-white text-lg">AI-Powered</h3>
                    <p className="text-foreground-secondary text-sm">Advanced summarization technology</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-6 h-6 text-accent-gold" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-serif text-white text-lg">Premium Features</h3>
                    <p className="text-foreground-secondary text-sm">Audio summaries and video exports</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="glass-lg p-8 md:p-10 animate-fade-in-up">
              <h2 className="text-3xl font-serif text-white mb-2">Sign In</h2>
              <p className="text-foreground-secondary mb-8 text-sm">Enter your credentials to access your account</p>

              {error && (
                <div className="mb-6 p-4 bg-red-950/80 border border-red-700/50 rounded-lg">
                  <p className="text-red-300 text-sm">{error}</p>
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
                    disabled={submitting || isLoading}
                  />
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block text-foreground-secondary text-sm font-medium mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 transition-all focus:bg-white/8 focus:border-accent-neon-blue focus:outline-none focus:shadow-lg focus:shadow-accent-neon-blue/20"
                    required
                    disabled={submitting || isLoading}
                  />
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-white/20 bg-white/5" />
                    <span className="text-foreground-secondary">Remember me</span>
                  </label>
                  <Link href="#" className="text-accent-gold hover:text-accent-gold-light transition-colors">
                    Forgot password?
                  </Link>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={submitting || isLoading}
                  className="w-full bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-bold py-3 rounded-lg transition-all hover:shadow-xl hover:shadow-accent-gold/40 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                >
                  {submitting || isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {/* Divider */}
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-gradient-to-r from-background via-background-secondary to-background text-foreground-secondary">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Google Sign In */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="border-2 border-white/10 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all hover:border-accent-neon-blue hover:bg-accent-neon-blue/5"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="hidden sm:inline">Google</span>
                </button>

                {/* Apple Sign In */}
                <button
                  type="button"
                  onClick={handleAppleLogin}
                  className="border-2 border-white/10 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all hover:border-accent-neon-blue hover:bg-accent-neon-blue/5"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 20H6c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2zm-2-12c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Apple</span>
                </button>
              </div>

              {/* Sign Up Link */}
              <div className="text-center text-sm">
                <span className="text-foreground-secondary">Don&apos;t have an account? </span>
                <Link href="/auth/signup" className="text-accent-gold hover:text-accent-gold-light font-semibold transition-colors">
                  Sign up
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
