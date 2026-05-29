'use client';

import { Navigation } from '@/components/Navigation';
import SilkProMailer from '@/components/mailer/gammadyne/SilkProMailer';
import WalletCard from '@/components/mailer/WalletCard';

export default function MailerPage() {
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-background via-background-secondary to-background pt-20">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-900/20 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent-gold/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
        </div>

        {/* Header */}
        <div className="relative border-b border-white/10 bg-black/30 backdrop-blur-lg">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <div className="flex items-center gap-4 mb-3">
              <div className="relative">
                <div className="absolute inset-0 bg-accent-gold/30 rounded-xl blur-lg" />
                <div className="relative rounded-xl bg-gradient-to-br from-accent-gold via-accent-gold-light to-accent-neon-blue p-3">
                  <svg className="h-7 w-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-serif text-white">
                  <span className="text-accent-gold">Silk</span> Mailer
                </h1>
              </div>
            </div>
            <div className="text-foreground-secondary ml-[4.5rem] flex items-center gap-4">
              <p className="m-0">Craft and send elegant email campaigns <span className="text-accent-gold">⚡ pro features</span>, SMTP rotation, mail merge, verification & more</p>
              <span className="flex-1" />
              <WalletCard compact />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative mx-auto max-w-7xl px-6 py-8">
          <SilkProMailer />
        </div>
      </div>
    </>
  );
}