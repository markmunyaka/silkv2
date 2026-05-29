'use client';

import { useState, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────
interface SmtpPlan {
  id: string;
  name: string;
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  fromEmail: string;
  fromName: string | null;
  maxEmailsPerDay: number;
  maxEmailsPerHour: number;
  delayBetweenEmailsMs: number;
  testStatus: string | null;
  // Virtual inventory fields
  stockLevel: 'abundant' | 'limited' | 'critical';
  stockCount: number;
  pricePerEmail: number;
  features: string[];
  location: string;
  latency: number;
}

interface PurchaseModalState {
  open: boolean;
  plan: SmtpPlan | null;
}

// ─── Enrich API providers with storefront fields ─────────────────────────
function enrichProviders(providers: any[]): SmtpPlan[] {
  return providers.map((p, i) => ({
    ...p,
    stockLevel: (p.maxEmailsPerDay >= 10000 ? 'limited' : p.maxEmailsPerDay >= 1000 ? 'abundant' : 'abundant') as 'abundant' | 'limited' | 'critical',
    stockCount: Math.max(1, Math.floor(50 - (p.maxEmailsPerDay / 500))),
    pricePerEmail: Math.max(0.003, Math.round((p.maxEmailsPerDay * 0.003) / p.maxEmailsPerDay * 1000) / 1000),
    features: [
      'SSL/TLS Dedicated Ports (465/587)',
      p.maxEmailsPerDay >= 5000 ? 'Multi-IP Pool Rotation' : 'Clean IP Range — No Blacklists',
      'Instant SPF/DKIM Verification',
      `Hourly & Daily Rate Limiting (${p.maxEmailsPerHour}/hr)`,
      p.testStatus === 'passed' ? '✅ Pre-Tested & Verified' : 'Pending Verification',
    ],
    location: p.host?.includes('aws') ? 'AWS Cloud · Auto-scaled' :
              p.host?.includes('sendgrid') ? 'SendGrid · Managed' :
              'Private Server · Dedicated',
    latency: p.host?.includes('aws') ? 12 : p.host?.includes('sendgrid') ? 8 : 15,
  }));
}

function providerIcon(type: string) {
  switch (type) {
    case 'aws_ses': return '☁️';
    case 'sendgrid': return '✉️';
    default: return '📧';
  }
}

function StockBadge({ level, count }: { level: string; count: number }) {
  const styles: Record<string, { label: string; classes: string }> = {
    abundant: { label: '✅ High Availability', classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    limited: { label: '⚠️ Limited Slots Left', classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    critical: { label: `🔴 Only ${count} Servers Available`, classes: 'bg-red-500/15 text-red-400 border-red-500/30' },
  };
  const s = styles[level] || styles.abundant;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold rounded-full border ${s.classes}`}>
      {s.label}
    </span>
  );
}

function LatencyIndicator({ ms }: { ms: number }) {
  const color = ms < 10 ? 'bg-emerald-400' : ms < 15 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 text-xs text-foreground-secondary">
      <span className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${color} animate-pulse`} />{ms}ms latency
      </span>
    </div>
  );
}

function PlanCard({ plan, onBuy }: { plan: SmtpPlan; onBuy: (plan: SmtpPlan) => void }) {
  const usagePercent = Math.round((plan.maxEmailsPerHour / plan.maxEmailsPerDay) * 100);

  return (
    <div className="group relative glass-lg rounded-2xl border border-white/5 hover:border-accent-gold/30 transition-all duration-500 overflow-hidden">
      <div className="absolute -inset-px bg-gradient-to-br from-accent-gold/0 via-accent-gold/0 to-accent-neon-blue/0 group-hover:from-accent-gold/10 group-hover:via-accent-neon-blue/5 group-hover:to-accent-gold/10 rounded-2xl transition-all duration-700 pointer-events-none" />
      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/20 flex items-center justify-center text-lg shrink-0 border border-white/5">
              {providerIcon(plan.provider)}
            </div>
            <div>
              <h3 className="text-white font-semibold text-base leading-tight">{plan.name}</h3>
              <p className="text-foreground-secondary text-xs mt-0.5">{plan.host}</p>
              <LatencyIndicator ms={plan.latency} />
            </div>
          </div>
          <StockBadge level={plan.stockLevel} count={plan.stockCount} />
        </div>

        <div className="mb-5 p-4 rounded-xl bg-white/5 border border-white/5">
          <p className="text-[10px] text-foreground-secondary uppercase tracking-widest font-medium mb-2">Sending Power</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-2xl font-serif font-bold text-white">{plan.maxEmailsPerHour.toLocaleString()}</p>
              <p className="text-[10px] text-foreground-secondary">Emails / Hour</p>
            </div>
            <div>
              <p className="text-2xl font-serif font-bold text-accent-gold">{plan.maxEmailsPerDay.toLocaleString()}</p>
              <p className="text-[10px] text-foreground-secondary">Emails / Day</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-foreground-secondary mb-1">
              <span>Hourly capacity usage</span>
              <span>{usagePercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-accent-gold to-accent-neon-blue transition-all duration-500" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        </div>

        <ul className="space-y-2.5 mb-6">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs text-foreground-secondary">
              <span className="w-4 h-4 rounded-full bg-accent-gold/20 flex items-center justify-center text-[8px] text-accent-gold shrink-0 mt-0.5">✦</span>
              {f}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 mb-5 p-3 rounded-lg bg-accent-neon-blue/5 border border-accent-neon-blue/10">
          <span className="text-xs">🔒</span>
          <p className="text-[10px] text-accent-neon-blue/70">SSL/TLS encryption · Dedicated ports 465/587</p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div>
            <p className="text-2xl font-serif font-bold text-white">
              ${(plan.pricePerEmail * 1000).toFixed(2)}
              <span className="text-xs text-foreground-secondary font-normal font-sans"> /1k emails</span>
            </p>
            <p className="text-[10px] text-foreground-secondary">pay in crypto · no subscription</p>
          </div>
          <button onClick={() => onBuy(plan)} className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-xl hover:shadow-accent-gold/40 transition-all duration-300 active:scale-[0.97]">
            Buy with Crypto
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseModal({ plan, onClose }: { plan: SmtpPlan; onClose: () => void }) {
  const [domain, setDomain] = useState('');
  const [step, setStep] = useState<'domain' | 'confirm' | 'success'>('domain');
  const [processing, setProcessing] = useState(false);

  const handleContinue = () => {
    if (!domain.trim()) return;
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setStep('success');
    setProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-lg rounded-2xl border border-white/10 p-6 w-full max-w-md mx-4 animate-fade-in-up shadow-2xl overflow-hidden">
        <button onClick={onClose} className="float-right text-foreground-secondary hover:text-white text-lg transition-colors">✕</button>

        {step === 'domain' && (
          <>
            <div className="mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/20 flex items-center justify-center text-xl mb-4">{providerIcon(plan.provider)}</div>
              <h3 className="text-xl font-serif text-white mb-1">Configure your SMTP</h3>
              <p className="text-sm text-foreground-secondary">You are purchasing <strong className="text-accent-gold">{plan.name}</strong></p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 mb-5">
              <div className="flex justify-between text-sm mb-2"><span className="text-foreground-secondary">Plan</span><span className="text-white font-medium">{plan.name}</span></div>
              <div className="flex justify-between text-sm mb-2"><span className="text-foreground-secondary">Sending limit</span><span className="text-white font-medium">{plan.maxEmailsPerDay.toLocaleString()} / day</span></div>
              <div className="flex justify-between text-sm"><span className="text-foreground-secondary">Price</span><span className="text-accent-gold font-bold">${(plan.pricePerEmail * 1000).toFixed(2)} /1k emails</span></div>
            </div>
            <div className="mb-6">
              <label className="block text-sm text-foreground-secondary mb-2">Custom sending domain <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-secondary">📧</span>
                <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="mail.yourcompany.com" className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold/30 transition-all" autoFocus />
              </div>
              <p className="text-[10px] text-foreground-secondary mt-1.5">This domain will be verified and attached to your SMTP mailbox</p>
            </div>
            <button onClick={handleContinue} disabled={!domain.trim()} className="w-full py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-lg hover:shadow-accent-gold/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              Continue to Payment →
            </button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="mb-6">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-xl mb-4">🛒</div>
              <h3 className="text-xl font-serif text-white mb-1">Confirm Purchase</h3>
              <p className="text-sm text-foreground-secondary">Review your order before processing</p>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/5"><span className="text-sm text-foreground-secondary">SMTP Server</span><span className="text-sm text-white font-medium">{plan.name}</span></div>
              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/5"><span className="text-sm text-foreground-secondary">Sending Domain</span><span className="text-sm text-accent-gold font-mono">{domain}</span></div>
              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/5"><span className="text-sm text-foreground-secondary">Cost per email</span><span className="text-sm text-white font-bold">${plan.pricePerEmail} /email</span></div>
            </div>
            <div className="p-3 rounded-xl bg-accent-neon-blue/5 border border-accent-neon-blue/10 mb-6">
              <p className="text-xs text-accent-neon-blue/70 flex items-center gap-2">🔒 Pay with USDT (TRC-20) or other crypto</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('domain')} className="flex-1 py-2.5 text-sm rounded-xl border border-white/10 text-foreground-secondary hover:text-white transition-colors">Back</button>
              <button onClick={handleConfirm} disabled={processing} className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-lg hover:shadow-accent-gold/30 transition-all disabled:opacity-60">
                {processing ? '🔄 Processing...' : `Pay with Crypto`}
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-3xl mb-4 animate-bounce-in">✅</div>
            <h3 className="text-xl font-serif text-white mb-2">Payment Sent!</h3>
            <p className="text-sm text-foreground-secondary mb-1">Your SMTP server <strong className="text-accent-gold">{plan.name}</strong> will be provisioned after blockchain confirmation.</p>
            <p className="text-xs text-foreground-secondary/60 mb-6">Domain: {domain} · ${(plan.pricePerEmail * 1000).toFixed(2)}/1k emails</p>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 mb-6 text-left">
              <p className="text-xs text-foreground-secondary font-medium mb-2">📋 Next steps</p>
              <ul className="space-y-2">
                <li className="text-xs text-foreground-secondary flex items-start gap-2"><span className="text-emerald-400">1.</span> Wait for 3 blockchain confirmations</li>
                <li className="text-xs text-foreground-secondary flex items-start gap-2"><span className="text-emerald-400">2.</span> Add MX/DKIM records to your DNS</li>
                <li className="text-xs text-foreground-secondary flex items-start gap-2"><span className="text-emerald-400">3.</span> Start sending — your server is ready</li>
              </ul>
            </div>
            <button onClick={onClose} className="w-full py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-lg hover:shadow-accent-gold/30 transition-all">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SmtpStorefront() {
  const [plans, setPlans] = useState<SmtpPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<PurchaseModalState>({ open: false, plan: null });
  const [walletAddress] = useState('TS2Z5hrN212vjtquLGr8sSTfJjqV4rbYbX');

  useEffect(() => {
    fetch('/api/mailer/providers')
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.data) {
          setPlans(enrichProviders(json.data));
        } else {
          setPlans([]);
        }
      })
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = (plan: SmtpPlan) => {
    setPurchase({ open: true, plan });
  };

  const totalCapacity = plans.reduce((sum, p) => sum + p.maxEmailsPerDay, 0);
  const activePlans = plans.length;

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-white mb-1">📧 SMTP Storefront</h1>
          <p className="text-foreground-secondary text-sm">Purchase premium SMTP relay servers for your email campaigns</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-foreground-secondary">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {activePlans} active {activePlans === 1 ? 'plan' : 'plans'}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-accent-gold font-mono font-bold">{totalCapacity.toLocaleString()}</span>
            emails/day capacity
          </div>
        </div>
      </div>

      {/* Crypto Wallet Banner */}
      <div className="glass-lg rounded-xl border border-accent-gold/20 p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold/20 to-amber-500/20 flex items-center justify-center text-lg">₮</div>
          <div>
            <p className="text-sm text-foreground-secondary">Pay with Crypto</p>
            <p className="text-xs text-foreground-secondary/60 font-mono">USDT (TRC-20) · LTC · SOL</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-foreground-secondary">Send to wallet</p>
          <p className="text-xs text-accent-gold font-mono">{walletAddress.substring(0, 10)}...{walletAddress.slice(-4)}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-lg rounded-2xl border border-white/5 p-6 animate-pulse">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-white/10" />
                <div className="space-y-2 flex-1"><div className="h-4 w-32 bg-white/10 rounded" /><div className="h-3 w-24 bg-white/5 rounded" /></div>
              </div>
              <div className="h-24 bg-white/5 rounded-xl mb-4" />
              <div className="space-y-2 mb-6">{[1, 2, 3].map((j) => <div key={j} className="h-3 w-full bg-white/5 rounded" />)}</div>
              <div className="h-12 bg-white/10 rounded-xl" />
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="glass-lg rounded-xl p-12 text-center">
          <span className="text-4xl block mb-3">📧</span>
          <p className="text-lg text-white mb-1">No SMTP providers available yet</p>
          <p className="text-sm text-foreground-secondary">Admin needs to configure SMTP servers in the admin panel</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onBuy={handleBuy} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: '🔒', label: 'SSL/TLS Encrypted', desc: 'Bank-grade encryption in transit' },
          { icon: '⚡', label: 'Instant Provisioning', desc: 'Servers ready in under 60 seconds' },
          { icon: '🛡️', label: 'Clean IP Reputation', desc: 'Pre-warmed IP pools, no blacklists' },
          { icon: '₮', label: 'Crypto Payments', desc: 'USDT, Litecoin, Solana accepted' },
        ].map((f, i) => (
          <div key={i} className="glass-lg p-4 rounded-xl border border-white/5 text-center">
            <span className="text-2xl block mb-2">{f.icon}</span>
            <p className="text-white text-sm font-medium">{f.label}</p>
            <p className="text-foreground-secondary text-[10px] mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}