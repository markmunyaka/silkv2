'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ReferralCard() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [referralCount, setReferralCount] = useState(0);
  const [referralEarnings, setReferralEarnings] = useState(0);

  // Generate a unique referral link based on user ID
  const referralLink = user?.id
    ? `${window.location.origin}/signup?ref=${user.id}`
    : '';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = referralLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [referralLink]);

  // Load referral stats from localStorage for demo purposes
  useEffect(() => {
    if (!user?.id) return;
    const stored = localStorage.getItem(`referral_count_${user.id}`);
    if (stored) setReferralCount(parseInt(stored));
    const earnings = localStorage.getItem(`referral_earnings_${user.id}`);
    if (earnings) setReferralEarnings(parseInt(earnings));
  }, [user?.id]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🤝</span>
        <h3 className="text-lg font-serif text-white">Referral Program</h3>
      </div>
      <p className="text-foreground-secondary text-sm mb-5">
        Invite others and earn rewards when they join. Share your unique referral link below.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="p-3 rounded-lg bg-accent-gold/5 border border-accent-gold/20 text-center">
          <p className="text-2xl font-bold text-accent-gold">{referralCount}</p>
          <p className="text-[10px] text-foreground-secondary mt-0.5">Referrals</p>
        </div>
        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
          <p className="text-2xl font-bold text-emerald-400">${referralEarnings}</p>
          <p className="text-[10px] text-foreground-secondary mt-0.5">Earnings</p>
        </div>
      </div>

      {/* Referral Link */}
      <div className="mb-4">
        <label className="block text-xs text-foreground-secondary mb-1.5 font-medium">Your Referral Link</label>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={referralLink}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-accent-gold/60 transition-all"
          />
          <button
            onClick={handleCopy}
            className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
              copied
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-accent-gold/10 text-accent-gold border border-accent-gold/30 hover:bg-accent-gold/20'
            }`}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Share options */}
      <div className="space-y-2">
        <p className="text-[10px] text-foreground-secondary uppercase tracking-wider font-medium mb-2">Share via</p>
        <div className="flex gap-2">
          <a
            href={`https://twitter.com/intent/tweet?text=Check+out+Silk+Summary!+${encodeURIComponent(referralLink)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-xs text-foreground-secondary hover:text-white"
          >
            🐦 Twitter
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-xs text-foreground-secondary hover:text-white"
          >
            📘 Facebook
          </a>
          <a
            href={`mailto:?subject=Try+Silk+Road+V2&body=${encodeURIComponent(`Check out Silk Road V2: ${referralLink}`)}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-xs text-foreground-secondary hover:text-white"
          >
            ✉️ Email
          </a>
        </div>
      </div>

      <div className="mt-5 p-3 rounded-lg bg-accent-gold/[0.03] border border-accent-gold/[0.08]">
        <p className="text-[10px] text-foreground-secondary leading-relaxed">
          💰 Earn <span className="text-accent-gold font-bold">10%</span> of your referrals' first purchase as a reward.
          Rewards are credited to your wallet automatically within 24 hours.
        </p>
      </div>
    </div>
  );
}