'use client';

import { useState, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────
interface RdpProduct {
  id: string;
  name: string;
  specs: string;
  ram: string;
  storage: string;
  cpu: string;
  bandwidth: string;
  os: string[];
  location: string;
  price: number;
  priceUnit: 'month' | 'week' | 'day';
  stock: number;
  features: string[];
}

interface PurchaseModalState {
  open: boolean;
  product: RdpProduct | null;
}

// ─── OS Badge ────────────────────────────────────────────────────────────
function OsBadge({ os }: { os: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-medium rounded-full bg-accent-neon-blue/10 text-accent-neon-blue border border-accent-neon-blue/20">
      🪟 {os}
    </span>
  );
}

// ─── Stock Badge ─────────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="text-[10px] font-semibold text-red-400">🔴 Out of Stock</span>;
  if (stock < 5) return <span className="text-[10px] font-semibold text-amber-400">⚠️ Only {stock} left</span>;
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
function RdpCard({ product, onBuy }: { product: RdpProduct; onBuy: (p: RdpProduct) => void }) {
  const [showAllOs, setShowAllOs] = useState(false);
  const displayOs = showAllOs ? product.os : product.os.slice(0, 2);

  return (
    <div className="group relative glass-lg rounded-2xl border border-white/5 hover:border-accent-gold/30 transition-all duration-500 overflow-hidden">
      <div className="absolute -inset-px bg-gradient-to-br from-accent-gold/0 via-accent-gold/0 to-accent-neon-blue/0 group-hover:from-accent-gold/10 group-hover:via-accent-neon-blue/5 group-hover:to-accent-gold/10 rounded-2xl transition-all duration-700 pointer-events-none" />
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-accent-neon-blue/20 flex items-center justify-center text-lg shrink-0 border border-white/5">
              🖥️
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
          <p className="text-[10px] text-foreground-secondary uppercase tracking-widest font-medium mb-3">Specifications</p>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            {[
              { label: 'RAM', value: product.ram },
              { label: 'Storage', value: product.storage },
              { label: 'CPU', value: product.cpu },
              { label: 'Bandwidth', value: product.bandwidth },
            ].map((spec) => (
              <div key={spec.label}>
                <p className="text-[10px] text-foreground-secondary">{spec.label}</p>
                <p className="text-sm text-white font-medium">{spec.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* OS Options */}
        <div className="mb-4">
          <p className="text-[10px] text-foreground-secondary uppercase tracking-widest font-medium mb-2">Operating Systems</p>
          <div className="flex flex-wrap gap-1.5">
            {displayOs.map((os) => <OsBadge key={os} os={os} />)}
            {product.os.length > 2 && !showAllOs && (
              <button onClick={() => setShowAllOs(true)} className="text-[10px] text-accent-gold hover:underline">
                +{product.os.length - 2} more
              </button>
            )}
            {product.os.length > 2 && showAllOs && (
              <button onClick={() => setShowAllOs(false)} className="text-[10px] text-accent-gold hover:underline">
                show less
              </button>
            )}
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
function PurchaseModal({ product, onClose }: { product: RdpProduct; onClose: () => void }) {
  const [duration, setDuration] = useState<'1month' | '3months' | '6months' | '1year'>('1month');
  const [step, setStep] = useState<'configure' | 'confirm' | 'success'>('configure');
  const [selectedOs, setSelectedOs] = useState(product.os[0]);
  const [processing, setProcessing] = useState(false);
  const [insufficientBalance, setInsufficientBalance] = useState(false);

  // Read wallet USD balance
  const usdBalance = typeof window !== 'undefined'
    ? parseFloat(localStorage.getItem('wallet_usd_balance') || '0')
    : 0;

  const discountMap: Record<string, number> = {
    '1month': 1,
    '3months': 0.9,
    '6months': 0.8,
    '1year': 0.65,
  };
  const multiplierMap: Record<string, number> = {
    '1month': 1,
    '3months': 3,
    '6months': 6,
    '1year': 12,
  };

  const unitPrice = product.priceUnit === 'month' ? product.price : product.priceUnit === 'week' ? product.price * 4.33 : product.price * 30;
  const discount = discountMap[duration];
  const multiplier = multiplierMap[duration];
  const totalPrice = unitPrice * multiplier * discount;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-lg rounded-2xl border border-white/10 p-6 w-full max-w-md mx-4 animate-fade-in-up shadow-2xl overflow-hidden">
        <button onClick={onClose} className="float-right text-foreground-secondary hover:text-white text-lg transition-colors">✕</button>

        {step === 'configure' && (
          <>
            <div className="mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-accent-neon-blue/20 flex items-center justify-center text-xl mb-4">🖥️</div>
              <h3 className="text-xl font-serif text-white mb-1">Configure your RDP</h3>
              <p className="text-sm text-foreground-secondary">You are purchasing <strong className="text-accent-gold">{product.name}</strong></p>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/5 mb-5 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-foreground-secondary">Plan</span><span className="text-white font-medium">{product.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-foreground-secondary">Specs</span><span className="text-white font-medium">{product.ram} RAM / {product.storage}</span></div>
              <div className="flex justify-between text-sm"><span className="text-foreground-secondary">Location</span><span className="text-white font-medium">{product.location}</span></div>
            </div>

            {/* OS Selection */}
            <div className="mb-5">
              <label className="block text-sm text-foreground-secondary mb-2">Operating System</label>
              <select
                value={selectedOs}
                onChange={(e) => setSelectedOs(e.target.value)}
                className="w-full py-2.5 px-4 text-sm rounded-xl border border-white/10 bg-white/5 text-white focus:border-accent-gold focus:outline-none"
              >
                {product.os.map((os) => <option key={os} value={os}>{os}</option>)}
              </select>
            </div>

            {/* Duration Selection */}
            <div className="mb-6">
              <label className="block text-sm text-foreground-secondary mb-2">Subscription Duration</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: '1month' as const, label: '1 Month', discount: '' },
                  { id: '3months' as const, label: '3 Months', discount: '-10%' },
                  { id: '6months' as const, label: '6 Months', discount: '-20%' },
                  { id: '1year' as const, label: '12 Months', discount: '-35%' },
                ]).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setDuration(opt.id)}
                    className={`p-3 rounded-xl border text-sm transition-all ${
                      duration === opt.id
                        ? 'border-accent-gold bg-accent-gold/10 text-white'
                        : 'border-white/10 bg-white/5 text-foreground-secondary hover:border-white/20'
                    }`}
                  >
                    <p className="font-medium">{opt.label}</p>
                    {opt.discount && <p className="text-[10px] text-accent-gold">{opt.discount}</p>}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Summary */}
            <div className="p-3 rounded-xl bg-accent-gold/5 border border-accent-gold/20 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground-secondary">Total</span>
                <span className="text-xl font-serif font-bold text-accent-gold">${totalPrice.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-foreground-secondary mt-1">
                ${unitPrice.toFixed(2)}/{product.priceUnit} × {multiplier} {multiplier === 1 ? 'unit' : 'units'}
                {discount < 1 && ` · ${Math.round((1 - discount) * 100)}% off`}
              </p>
            </div>

          {insufficientBalance && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-400">
              ⚠️ Insufficient balance. You need <strong>${totalPrice.toFixed(2)}</strong> but your wallet has <strong>${usdBalance.toFixed(2)}</strong>.
              Redirecting to deposit...
            </div>
          )}
          <button onClick={() => setStep('confirm')} className="w-full py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-lg hover:shadow-accent-gold/30 transition-all">
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
              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/5"><span className="text-sm text-foreground-secondary">Product</span><span className="text-sm text-white font-medium">{product.name}</span></div>
              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/5"><span className="text-sm text-foreground-secondary">OS</span><span className="text-sm text-accent-gold font-mono">{selectedOs}</span></div>
              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/5"><span className="text-sm text-foreground-secondary">Duration</span><span className="text-sm text-white">{duration.replace('months', ' months').replace('year', ' year')}</span></div>
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
            <p className="text-sm text-foreground-secondary mb-1">Your <strong className="text-accent-gold">{product.name}</strong> RDP will be provisioned shortly.</p>
            <p className="text-xs text-foreground-secondary/60 mb-6">{selectedOs} · {duration.replace('months', ' months').replace('year', ' year')} · ${totalPrice.toFixed(2)}</p>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 mb-6 text-left">
              <p className="text-xs text-foreground-secondary font-medium mb-2">📋 Next steps</p>
              <ul className="space-y-2">
                <li className="text-xs text-foreground-secondary flex items-start gap-2"><span className="text-emerald-400">1.</span> Wait for blockchain confirmation (1-2 min)</li>
                <li className="text-xs text-foreground-secondary flex items-start gap-2"><span className="text-emerald-400">2.</span> RDP credentials sent via Telegram / email</li>
                <li className="text-xs text-foreground-secondary flex items-start gap-2"><span className="text-emerald-400">3.</span> Connect via Remote Desktop and start using</li>
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
export default function RdpStoreCard() {
  const [products, setProducts] = useState<RdpProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<PurchaseModalState>({ open: false, product: null });

  // Fetch products from the database
  useEffect(() => {
    fetch('/api/store/rdp')
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

  const handleBuy = (product: RdpProduct) => {
    setPurchase({ open: true, product });
  };

  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const lowestPrice = products.length > 0 ? Math.min(...products.map((p) => p.price)) : 0;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-white mb-1">🖥️ RDP Store</h1>
          <p className="text-foreground-secondary text-sm">Purchase Windows VPS / RDP servers for your projects and automation needs</p>
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
            <p className="text-sm text-foreground-secondary">Instant Setup · Crypto Payments</p>
            <p className="text-xs text-foreground-secondary/60">All RDPs come with full admin access and dedicated IP</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-foreground-secondary">Total in stock</p>
          <p className="text-xs text-accent-gold font-mono">{totalStock} servers</p>
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
          <span className="text-4xl block mb-3">🖥️</span>
          <p className="text-lg text-white mb-1">No RDP products available yet</p>
          <p className="text-sm text-foreground-secondary">Admin needs to add RDP products in the admin panel</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {products.map((product) => (
            <RdpCard key={product.id} product={product} onBuy={handleBuy} />
          ))}
        </div>
      )}

      {/* Trust Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: '⚡', label: 'Instant Setup', desc: 'Servers ready in 5-10 minutes' },
          { icon: '🛡️', label: 'Admin Access', desc: 'Full RDP / administrator rights' },
          { icon: '🌐', label: 'Global Locations', desc: 'USA, EU, Asia data centers' },
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