'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Navigation } from '@/components/Navigation';
import { TurnstileWidgetComponent } from '@/components/TurnstileWidget';

export default function SignupPage() {
  const router = useRouter();
  const { signup, appleSignup, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // Validation
    if (!formData.name.trim()) {
      setError('Full name is required');
      setSubmitting(false);
      return;
    }

    if (!formData.email.trim()) {
      setError('Email address is required');
      setSubmitting(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      setSubmitting(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setSubmitting(false);
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      setError('Password must contain uppercase letters, lowercase letters, and numbers');
      setSubmitting(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setSubmitting(false);
      return;
    }

    try {
      if (!captchaToken) {
        setError('CAPTCHA verification required');
        setSubmitting(false);
        return;
      }
      await signup(formData.email.toLowerCase(), formData.password, formData.name);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
      setSubmitting(false);
    }
  };

  const handleGoogleSignup = () => {
    // TODO: Implement Google OAuth
    setError('Google signup coming soon');
  };

  const handleAppleSignup = () => {
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Left Side - Benefits */}
            <div className="hidden lg:block space-y-8 pt-8">
              <div>
                <h1 className="text-5xl font-serif text-white mb-4 leading-tight">
                  Start Summarizing
                </h1>
                <p className="text-xl text-foreground-secondary">
                  Free trial includes 2 PDF summaries, then upgrade for unlimited access
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
                    <h3 className="font-serif text-white text-lg">No Credit Card</h3>
                    <p className="text-foreground-secondary text-sm">Start free, pay only when you want unlimited</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-6 h-6 text-accent-neon-blue" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-serif text-white text-lg">Instant Access</h3>
                    <p className="text-foreground-secondary text-sm">Start using premium tools immediately</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-6 h-6 text-accent-gold" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-serif text-white text-lg">AI-Powered</h3>
                    <p className="text-foreground-secondary text-sm">Advanced technology for perfect summaries</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Signup Form */}
            <div className="glass-lg p-8 md:p-10 animate-fade-in-up">
              <h2 className="text-3xl font-serif text-white mb-2">Create Account</h2>
              <p className="text-foreground-secondary mb-8 text-sm">Join thousands of professionals streamlining their workflow</p>

              {error && (
                <div className="mb-6 p-4 bg-red-950/80 border border-red-700/50 rounded-lg">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6 mb-8">
                {/* Full Name Field */}
                <div>
                  <label htmlFor="name" className="block text-foreground-secondary text-sm font-medium mb-2">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 transition-all focus:bg-white/8 focus:border-accent-neon-blue focus:outline-none focus:shadow-lg focus:shadow-accent-neon-blue/20"
                    disabled={submitting || isLoading}
                    required
                  />
                </div>

                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-foreground-secondary text-sm font-medium mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 transition-all focus:bg-white/8 focus:border-accent-neon-blue focus:outline-none focus:shadow-lg focus:shadow-accent-neon-blue/20"
                    disabled={submitting || isLoading}
                    required
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
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 transition-all focus:bg-white/8 focus:border-accent-neon-blue focus:outline-none focus:shadow-lg focus:shadow-accent-neon-blue/20"
                    disabled={submitting || isLoading}
                    required
                  />
                  <p className="text-xs text-foreground-secondary mt-2">Minimum 8 characters</p>
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-foreground-secondary text-sm font-medium mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 transition-all focus:bg-white/8 focus:border-accent-neon-blue focus:outline-none focus:shadow-lg focus:shadow-accent-neon-blue/20"
                    disabled={submitting || isLoading}
                    required
                  />
                </div>

                {/* CAPTCHA Verification */}
                <TurnstileWidgetComponent
                  siteKey="1x00000000000000000000AA"
                  onTokenChange={setCaptchaToken}
                />

                {/* Terms */}
                <div className="flex items-start gap-2 text-xs">
                  <input type="checkbox" className="w-4 h-4 rounded border-white/20 bg-white/5 mt-0.5" required />
                  <label className="text-foreground-secondary">
                    I agree to the <Link href="#" className="text-accent-gold hover:text-accent-gold-light">Terms of Service</Link> and <Link href="#" className="text-accent-gold hover:text-accent-gold-light">Privacy Policy</Link>
                  </label>
                </div>

                {/* Sign Up Button */}
                <button
                  type="submit"
                  disabled={submitting || isLoading}
                  className="w-full bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-bold py-3 rounded-lg transition-all hover:shadow-xl hover:shadow-accent-gold/40 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                >
                  {submitting || isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>

              {/* Divider */}
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-gradient-to-r from-background via-background-secondary to-background text-foreground-secondary">
                    Or sign up with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Google Sign Up */}
                <button
                  type="button"
                  onClick={handleGoogleSignup}
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

                {/* Apple Sign Up */}
                <button
                  type="button"
                  onClick={handleAppleSignup}
                  className="border-2 border-white/10 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all hover:border-accent-neon-blue hover:bg-accent-neon-blue/5"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 20H6c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2zm-2-12c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Apple</span>
                </button>
              </div>

              {/* Sign In Link */}
              <div className="text-center text-sm">
                <span className="text-foreground-secondary">Already have an account? </span>
                <Link href="/auth/login" className="text-accent-gold hover:text-accent-gold-light font-semibold transition-colors">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

