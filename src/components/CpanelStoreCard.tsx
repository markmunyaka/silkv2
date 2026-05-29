'use client';

import { useState, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────
interface CpanelProduct {
  id: string;
  name: string;
  specs: string;
  diskSpace: string;
  bandwidth: string;
  websites: number;
  emailAccounts: number;
  databases: number;
  ssl: boolean;
  location: string;
  price: number;
  priceUnit: 'month' | 'year';
  stock: number;
  features: string[];
}

interface PurchaseModalState {
  open: boolean;
  product: CpanelProduct | null;
}

// ─── Stock Badge ─────────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="text-[10px] font-semibold text-red-400">🔴 Out of Stock</span>;
  if (stock < 10) return <span className="text-[10px] font-semibold text-amber-400">⚠️ Only {stock} left</span>;
  return <span className="text-[10px] font-semibold text-emerald-400">✅ In Stock ({stock})</span>;
}

// ─── Price Display ───────────────────────────────────────────────────────
function PriceDisplay({ price, unit }: { price: number; unit: string }) {
  return (
    <div>
      <p className="text-2xl font-serif font-bold text-white">
        ${price.toFixed(2)}
        <span className="text-xs text-foreground-secondary font-normal font-sans"> /{unit}</span>
      </p>
    </div>
  );
}

// ─── Product Card ────────────────────────────────────────────────────────
function CpanelCard({ product, onBuy }: { product: CpanelProduct; onBuy: (p: CpanelProduct) => void }) {
  return (
    <div className="group relative glass-lg rounded-2xl border border-white/5 hover:border-accent-gold/30 transition-all duration-500 overflow-hidden">
      <div className="absolute -inset-px bg-gradient-to-br from-accent-gold/0 via-accent-gold/0 to-accent-neon-blue/0 group-hover:from-accent-gold/10 group-hover:via-accent-neon-blue/5 group-hover:to-accent-gold/10 rounded-2xl transition-all duration-700 pointer-events-none" />
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-accent-gold/20 flex items-center justify-center text-lg shrink-0 border border-white/5">
              🌐
            </div>
            <div>
              <h3 className="text-white font-semibold text-base leading-tight">{product.name}</h3>
              <p className="text-foreground-secondary text-xs mt-0.5">{product.specs}</p>
              <p className="text-foreground-secondary/60 text-[10px]">{product.location}</p>
            </div>
          </div>
          <StockBadge stock={product.stock} />
        </div>

        {/* Specs Grid */}
        <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/5">
          <p className="text-[10px] text-foreground-secondary uppercase tracking-widest font-medium mb-3">Plan Details</p>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            {[
              { label: 'Disk Space', value: product.diskSpace },
              { label: 'Bandwidth', value: product.bandwidth },
              { label: 'Websites', value: product.websites === -1 ? 'Unlimited' : String(product.websites) },
              { label: 'Email Accounts', value: product.emailAccounts === -1 ? 'Unlimited' : String(product.emailAccounts) },
              { label: 'Databases', value: product.databases === -1 ? 'Unlimited' : String(product.databases) },
              { label: 'SSL', value: product.ssl ? 'Free AutoSSL ✅' : '❌ Not included' },
            ].map((spec) => (
              <div key={spec.label}>
                <p className="text-[10px] text-foreground-secondary">{spec.label}</p>
                <p className="text-sm text-white font-medium">{spec.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-2 mb-5">
          {product.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs text-foreground-secondary">
              <span className="w-4 h-4 rounded-full bg-accent-gold/20 flex items-center justify-center text-[8px] text-accent-gold shrink-0 mt-0.5">✦</span>
              {f}
            </li>
          ))}
        </ul>

        {/* Bottom: Price + Buy */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <PriceDisplay price={product.price} unit={product.priceUnit} />
          <button
            onClick={() => onBuy(product)}
            disabled={product.stock <= 0}
            className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-xl hover:shadow-accent-gold/40 transition-all duration-300 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {product.stock <= 0 ? 'Out of Stock' : 'Buy Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Purchase Modal ──────────────────────────────────────────────────────
function PurchaseModal({ product, onClose }: { product: CpanelProduct; onClose: () => void }) {
  const [domain, setDomain] = useState('');
  const [step, setStep] = useState<'configure' | 'confirm' | 'success'>('configure');
  const [processing, setProcessing] = useState(false);
  const [insufficientBalance, setInsufficientBalance] = useState(false);

  // Read wallet USD balance
  const usdBalance = typeof window !== 'undefined'
    ? parseFloat(localStorage.getItem('wallet_usd_balance') || '0')
    : 0;

  const handleConfirm = async () => {
    if (usdBalance < totalPrice) {
      setInsufficientBalance(true);
      window.dispatchEvent(new CustomEvent('redirect-to-deposit', {
        detail: { required: totalPrice, balance: usdBalance }
      }));
      return;
    }

    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setStep('success');
    setProcessing(false);
  };

  const totalPrice = product.priceUnit === 'year' ? product.price : product.price;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-lg rounded-2xl border border-white/10 p-6 w-full max-w-md mx-4 animate-fade-in-up shadow-2xl overflow-hidden">
        <button onClick={onClose} className="float-right text-foreground-secondary hover:text-white text-lg transition-colors">✕</button>

        {step === 'configure' && (
          <>
            <div className="mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-accent-gold/20 flex items-center justify-center text-xl mb-4">🌐</div>
              <h3 className="text-xl font-serif text-white mb-1">Configure Hosting</h3>
              <p className="text-sm text-foreground-secondary">You are purchasing <strong className="text-accent-gold">{product.name}</strong></p>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/5 mb-5 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-foreground-secondary">Plan</span><span className="text-white font-medium">{product.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-foreground-secondary">Specs</span><span className="text-white font-medium">{product.diskSpace} / {product.bandwidth}</span></div>
              <div className="flex justify-between text-sm"><span className="text-foreground-secondary">Location</span><span className="text-white font-medium">{product.location}</span></div>
            </div>

            {/* Domain Input */}
            <div className="mb-6">
              <label className="block text-sm text-foreground-secondary mb-2">Your Domain <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-secondary">🌐</span>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="yourdomain.com"
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold/30 transition-all"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-foreground-secondary mt-1.5">Point your domain's nameservers to us after purchase for setup</p>
            </div>

            {/* Price Summary */}
            <div className="p-3 rounded-xl bg-accent-gold/5 border border-accent-gold/20 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground-secondary">Total</span>
                <span className="text-xl font-serif font-bold text-accent-gold">${totalPrice.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-foreground-secondary mt-1">Billed {product.priceUnit === 'year' ? 'annually' : 'monthly'}</p>
            </div>

            {insufficientBalance && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-400">
                ⚠️ Insufficient balance. You need <strong>${totalPrice.toFixed(2)}</strong> but your wallet has <strong>${usdBalance.toFixed(2)}</strong>.
                Redirecting to deposit...
              </div>
            )}
            <button
              onClick={() => setStep('confirm')}
              disabled={!domain.trim()}
              className="w-full py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-lg hover:shadow-accent-gold/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
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
              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/5"><span className="text-sm text-foreground-secondary">Plan</span><span className="text-sm text-white font-medium">{product.name}</span></div>
              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/5"><span className="text-sm text-foreground-secondary">Domain</span><span className="text-sm text-accent-gold font-mono">{domain}</span></div>
              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/5"><span className="text-sm text-foreground-secondary">Billing</span><span className="text-sm text-white">{product.priceUnit === 'year' ? 'Annual' : 'Monthly'}</span></div>
              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/5"><span className="text-sm text-foreground-secondary">Total</span><span className="text-sm text-accent-gold font-bold">${totalPrice.toFixed(2)}</span></div>
            </div>
            <div className="p-3 rounded-xl bg-accent-neon-blue/5 border border-accent-neon-blue/10 mb-6">
              <p className="text-xs text-accent-neon-blue/70 flex items-center gap-2">🔒 Pay with USDT (TRC-20) or other crypto</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('configure')} className="flex-1 py-2.5 text-sm rounded-xl border border-white/10 text-foreground-secondary hover:text-white transition-colors">Back</button>
              <button onClick={handleConfirm} disabled={processing} className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-lg hover:shadow-accent-gold/30 transition-all disabled:opacity-60">
                {processing ? '🔄 Processing...' : `Pay $${totalPrice.toFixed(2)}`}
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-3xl mb-4 animate-bounce-in">✅</div>
            <h3 className="text-xl font-serif text-white mb-2">Payment Received!</h3>
            <p className="text-sm text-foreground-secondary mb-1">Your <strong className="text-accent-gold">{product.name}</strong> hosting will be provisioned shortly.</p>
            <p className="text-xs text-foreground-secondary/60 mb-6">{domain} · ${totalPrice.toFixed(2)}</p>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 mb-6 text-left">
              <p className="text-xs text-foreground-secondary font-medium mb-2">📋 Next steps</p>
              <ul className="space-y-2">
                <li className="text-xs text-foreground-secondary flex items-start gap-2"><span className="text-emerald-400">1.</span> Wait for blockchain confirmation (1-2 min)</li>
                <li className="text-xs text-foreground-secondary flex items-start gap-2"><span className="text-emerald-400">2.</span> cPanel login credentials sent to your email</li>
                <li className="text-xs text-foreground-secondary flex items-start gap-2"><span className="text-emerald-400">3.</span> Update your domain nameservers to point to us</li>
                <li className="text-xs text-foreground-secondary flex items-start gap-2"><span className="text-emerald-400">4.</span> Start building & hosting your sites</li>
              </ul>
            </div>
            <button onClick={onClose} className="w-full py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-lg hover:shadow-accent-gold/30 transition-all">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────
export default function CpanelStoreCard() {
  const [products, setProducts] = useState<CpanelProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<PurchaseModalState>({ open: false, product: null });

  // Fetch products from the database
  useEffect(() => {
    fetch('/api/store/cpanel')
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.data) {
          setProducts(json.data);
        } else {
          setProducts([]);
        }
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = (product: CpanelProduct) => {
    setPurchase({ open: true, product });
  };

  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const lowestPrice = products.length > 0 ? Math.min(...products.map((p) => p.price)) : 0;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-white mb-1">🌐 cPanel Store</h1>
          <p className="text-foreground-secondary text-sm">Premium cPanel hosting plans — shared hosting, reseller, and enterprise VPS solutions</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-foreground-secondary">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {products.length} plans available
          </div>
          {lowestPrice > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-accent-gold font-mono font-bold">${lowestPrice.toFixed(2)}</span>
              starting price
            </div>
          )}
        </div>
      </div>

      {/* Quick Info Banner */}
      <div className="glass-lg rounded-xl border border-accent-gold/20 p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold/20 to-amber-500/20 flex items-center justify-center text-lg">⚡</div>
          <div>
            <p className="text-sm text-foreground-secondary">Instant cPanel Setup · Crypto Payments</p>
            <p className="text-xs text-foreground-secondary/60">All plans include cPanel/WHM, free SSL, and 24/7 support</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-foreground-secondary">Total slots left</p>
          <p className="text-xs text-accent-gold font-mono">{totalStock} available</p>
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
      ) : products.length === 0 ? (
        <div className="glass-lg rounded-xl p-12 text-center">
          <span className="text-4xl block mb-3">🌐</span>
          <p className="text-lg text-white mb-1">No cPanel products available yet</p>
          <p className="text-sm text-foreground-secondary">Admin needs to add cPanel products in the admin panel</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {products.map((product) => (
            <CpanelCard key={product.id} product={product} onBuy={handleBuy} />
          ))}
        </div>
      )}

      {/* Trust Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: '⚡', label: 'Instant Setup', desc: 'cPanel ready in under 5 minutes' },
          { icon: '🛡️', label: 'Free SSL', desc: 'AutoSSL included on all plans' },
          { icon: '🌐', label: 'Global Servers', desc: 'USA, EU, UK data centers' },
          { icon: '₮', label: 'Crypto Payments', desc: 'USDT, BTC, LTC, SOL accepted' },
        ].map((f, i) => (
          <div key={i} className="glass-lg p-4 rounded-xl border border-white/5 text-center">
            <span className="text-2xl block mb-2">{f.icon}</span>
            <p className="text-white text-sm font-medium">{f.label}</p>
            <p className="text-foreground-secondary text-[10px] mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Purchase Modal */}
      {purchase.open && purchase.product && (
        <PurchaseModal product={purchase.product} onClose={() => setPurchase({ open: false, product: null })} />
      )}
    </div>
  );
}