'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const CRYPTO_OPTIONS = [
  { id: 'usdt-trc20', label: 'USDT (TRC-20)', symbol: 'USDT', icon: '₮', network: 'TRC-20', color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' },
  { id: 'usdt-erc20', label: 'USDT (ERC-20)', symbol: 'USDT', icon: '₮', network: 'ERC-20', color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/30' },
  { id: 'litecoin', label: 'Litecoin', symbol: 'LTC', icon: 'Ł', network: 'LTC', color: 'text-silver-400', bgColor: 'bg-slate-500/20', borderColor: 'border-slate-500/30' },
  { id: 'solana', label: 'Solana', symbol: 'SOL', icon: '◎', network: 'SOL', color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/30' },
];

const EMAILS_PER_PACK = 20000;
const PRICE_PER_PACK = 30;
const REQUIRED_CONFIRMATIONS = 3;
const POLL_INTERVAL_MS = 8000;

export default function DepositCard() {
  const { user } = useAuth();
  const [emailBalance, setEmailBalance] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [recharging, setRecharging] = useState(false);
  const [rechargeSuccess, setRechargeSuccess] = useState<string | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [amountUsd, setAmountUsd] = useState(30);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [paymentSent, setPaymentSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmations, setConfirmations] = useState(0);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('silk_mailer_email_balance');
    setEmailBalance(stored ? parseInt(stored) : 0);
    setHydrated(true);
  }, []);

  const saveBalance = useCallback((balance: number) => {
    setEmailBalance(balance);
    localStorage.setItem('silk_mailer_email_balance', String(balance));
    window.dispatchEvent(new CustomEvent('email-balance-update', { detail: balance }));
  }, []);

  // Convert USD amount to packs
  const packsToBuy = Math.max(1, Math.round(amountUsd / PRICE_PER_PACK));
  const totalEmails = packsToBuy * EMAILS_PER_PACK;
  const totalPrice = packsToBuy * PRICE_PER_PACK;

  const handleCreatePayment = async () => {
    if (!user?.id || !selectedCrypto) return;
    setRecharging(true);
    setRechargeSuccess(null);
    setVerifyError(null);

    try {
      const res = await fetch('/api/wallet/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crypto: selectedCrypto, packsToBuy }),
      });
      if (!res.ok) throw new Error('Failed to create payment');
      const data = await res.json();
      setOrderId(data.orderId);
      setPaymentSent(true);
      setRecharging(false);

      const userTxHash = prompt(
        `Send exactly $${data.amountUsd} USD in ${selectedCrypto.toUpperCase()} to:\n\n${data.walletAddress}\n\nNetwork: ${data.network}\n\nAfter sending, paste your TXID to verify.`
      );
      if (userTxHash && userTxHash.length > 10) {
        setTxHash(userTxHash);
        setVerifying(true);
        setConfirmations(0);
      } else {
        setPaymentSent(false);
        setOrderId(null);
        setRechargeSuccess('Payment cancelled.');
      }
    } catch (err: any) {
      setRechargeSuccess(err.message || 'Failed');
      setRecharging(false);
    }
  };

  const pollVerification = useCallback(async () => {
    if (!orderId || !txHash || !verifying) return;
    try {
      const res = await fetch('/api/wallet/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, txHash }),
      });
      const data = await res.json();
      if (data.verified) {
        const total = data.emailsToCredit || totalEmails;
        saveBalance(emailBalance + total);
        setVerifying(false);
        setConfirmations(data.confirmations || REQUIRED_CONFIRMATIONS);
        setRechargeSuccess(`✅ $${totalPrice} USD deposited! ${total.toLocaleString()} credits credited.`);
        setTimeout(() => resetModal(), 5000);
      } else if (data.status === 'confirming') {
        setConfirmations(data.confirmations || 0);
      } else if (data.status === 'failed') {
        setVerifyError(data.error || 'Verification failed');
        setVerifying(false);
      }
    } catch { /* retry */ }
  }, [orderId, txHash, verifying, totalEmails, totalPrice, emailBalance, saveBalance]);

  useEffect(() => {
    if (!verifying || !orderId || !txHash) return;
    const interval = setInterval(pollVerification, POLL_INTERVAL_MS);
    pollVerification();
    return () => clearInterval(interval);
  }, [verifying, orderId, txHash, pollVerification]);

  const resetModal = () => {
    setRechargeSuccess(null); setSelectedCrypto(null);
    setOrderId(null); setTxHash(null); setPaymentSent(false);
    setVerifying(false); setConfirmations(0); setVerifyError(null); setRecharging(false);
  };

  const selectedCryptoData = CRYPTO_OPTIONS.find(c => c.id === selectedCrypto);

  if (!hydrated) return <div className="h-32 rounded-xl bg-white/5 animate-pulse" />;

  return (
    <div className="glass-lg rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📥</span>
        <h3 className="text-lg font-serif text-white">Deposit with Crypto</h3>
      </div>
      <p className="text-foreground-secondary text-sm mb-3">Current balance: <span className="text-accent-gold font-bold">{emailBalance.toLocaleString()} credits</span></p>

      {/* Amount Selector */}
      <div className="mb-5">
        <label className="block text-sm text-slate-400 mb-3">Deposit amount (USD)</label>
        <div className="flex items-center gap-3">
          <button onClick={() => setAmountUsd(Math.max(10, amountUsd - 10))} disabled={amountUsd <= 10}
            className="w-10 h-10 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 transition-all">−</button>
          <div className="flex-1 text-center">
            <p className="text-3xl font-bold text-white">${amountUsd}</p>
            <p className="text-xs text-slate-400">{totalEmails.toLocaleString()} credits</p>
          </div>
          <button onClick={() => setAmountUsd(amountUsd + 10)}
            className="w-10 h-10 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all">+</button>
        </div>
        {/* Quick amounts */}
        <div className="flex gap-2 mt-3">
          {[30, 50, 100, 200, 500].map(val => (
            <button key={val} onClick={() => setAmountUsd(val)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${amountUsd === val ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'}`}>
              ${val}
            </button>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-lg bg-accent-gold/10 border border-accent-gold/20">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Credits</span>
            <span className="text-white font-bold tabular-nums">{totalEmails.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">You pay</span>
            <span className="text-accent-gold font-bold tabular-nums">${totalPrice} USD</span>
          </div>
        </div>
      </div>

      {/* Crypto Selection */}
      <div className="mb-5">
        <label className="block text-sm text-slate-400 mb-3">Pay with</label>
        <div className="grid grid-cols-2 gap-2">
          {CRYPTO_OPTIONS.map((crypto) => {
            const isSelected = selectedCrypto === crypto.id;
            return (
              <button key={crypto.id} onClick={() => setSelectedCrypto(crypto.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  isSelected ? `${crypto.borderColor} ${crypto.bgColor} ring-2 ring-offset-2 ring-offset-background scale-105 shadow-lg`
                  : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30'
                }`}>
                <span className={`text-2xl ${crypto.color}`}>{crypto.icon}</span>
                <div className="text-left">
                  <p className={`text-sm font-bold ${isSelected ? crypto.color : 'text-white'}`}>{crypto.symbol}</p>
                  <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>{crypto.label}</p>
                </div>
                {isSelected && <span className="ml-auto text-lg">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment Info */}
      {selectedCrypto && (
        <div className="p-4 mb-5 rounded-lg bg-white/5 border border-white/10">
          <p className="text-sm text-slate-400 mb-2">Send <span className="text-white font-bold">${totalPrice} USD</span></p>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <span>Network: <strong className="text-accent-gold">{selectedCryptoData?.network}</strong></span>
          </div>
          <div className="p-2 rounded bg-black/30 border border-white/5">
            <p className="text-xs text-slate-500 font-mono">Wallet address shown after clicking deposit</p>
          </div>
          <p className="text-xs text-slate-500 mt-2">⚡ Credited after 3 confirmations</p>
        </div>
      )}

      <button onClick={handleCreatePayment} disabled={recharging || !selectedCrypto}
        className="w-full rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-4 py-3 font-medium text-black transition-all hover:shadow-lg hover:shadow-accent-gold/30 disabled:opacity-50 disabled:cursor-not-allowed">
        {recharging ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Processing...
          </span>
        ) : !selectedCrypto ? (
          'Select a crypto to deposit'
        ) : (
          `Deposit $${totalPrice} — Get ${totalEmails.toLocaleString()} credits`
        )}
      </button>

      {/* Confirmation progress */}
      {verifying && txHash && (
        <div className="mt-4 p-4 rounded-lg bg-accent-gold/10 border border-accent-gold/20 text-center">
          <p className="text-sm text-slate-400 mb-2">🔍 Checking blockchain...</p>
          <p className="text-xs text-slate-500 font-mono break-all mb-3">{txHash}</p>
          <div className="flex justify-center gap-2 mb-3">
            {Array.from({ length: REQUIRED_CONFIRMATIONS }).map((_, i) => (
              <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                i < confirmations ? 'bg-green-500 text-white'
                : i === confirmations ? 'bg-accent-gold/20 text-accent-gold border-2 border-accent-gold animate-pulse'
                : 'bg-white/5 text-slate-600 border border-white/10'
              }`}>{i < confirmations ? '✓' : i + 1}</div>
            ))}
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div className="bg-gradient-to-r from-accent-gold to-green-400 h-2 rounded-full transition-all"
              style={{ width: `${(confirmations / REQUIRED_CONFIRMATIONS) * 100}%` }} />
          </div>
          {verifyError && <p className="text-xs text-red-400 mt-2">❌ {verifyError}</p>}
        </div>
      )}

      {rechargeSuccess && (
        <div className={`mt-4 p-4 rounded-lg text-sm text-center ${rechargeSuccess.includes('✅') ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400'}`}>
          {rechargeSuccess}
        </div>
      )}

      <p className="text-xs text-slate-500 mt-4 text-center">🔒 Payments verified via blockchain explorers</p>
    </div>
  );
}