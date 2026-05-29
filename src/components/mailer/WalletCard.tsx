'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

interface WalletCardProps {
  compact?: boolean;
}

function getStoredBalance(): number {
  if (typeof window === 'undefined') return 0;
  const stored = localStorage.getItem('silk_mailer_email_balance');
  return stored ? parseInt(stored) : 0;
}

function saveStoredBalance(balance: number): void {
  localStorage.setItem('silk_mailer_email_balance', String(balance));
}

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

export default function WalletCard({ compact = false }: WalletCardProps) {
  const { user } = useAuth();
  const [emailBalance, setEmailBalance] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [recharging, setRecharging] = useState(false);
  const [rechargeSuccess, setRechargeSuccess] = useState<string | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [packsToBuy, setPacksToBuy] = useState(1);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [paymentSent, setPaymentSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmations, setConfirmations] = useState(0);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    setEmailBalance(getStoredBalance());
    setHydrated(true);
  }, []);

  const saveBalance = useCallback((balance: number) => {
    setEmailBalance(balance);
    localStorage.setItem('silk_mailer_email_balance', String(balance));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('email-balance-update', { detail: balance }));
    }
  }, []);

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

      if (!res.ok) throw new Error('Failed to create payment order');

      const data = await res.json();
      setOrderId(data.orderId);
      setPaymentSent(true);
      setRecharging(false);

      const userTxHash = prompt(
        `Send exactly $${data.amountUsd} USD in ${selectedCrypto.toUpperCase()} to:\n\n${data.walletAddress}\n\nNetwork: ${data.network}\n\nAfter sending, paste your transaction hash (TXID) below to verify.`
      );

      if (userTxHash && userTxHash.length > 10) {
        setTxHash(userTxHash);
        setVerifying(true);
        setConfirmations(0);
      } else {
        setPaymentSent(false);
        setOrderId(null);
        setRechargeSuccess('Payment cancelled — no transaction hash provided.');
      }
    } catch (err: any) {
      setRechargeSuccess(err.message || 'Failed to create payment');
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
        const totalEmails = data.emailsToCredit || (packsToBuy * EMAILS_PER_PACK);
        saveBalance(emailBalance + totalEmails);
        setVerifying(false);
        setConfirmations(data.confirmations || REQUIRED_CONFIRMATIONS);
        setRechargeSuccess(`✅ ${totalEmails.toLocaleString()} email sendouts credited after ${data.confirmations} confirmations!`);
        setTimeout(() => resetModal(), 5000);
      } else if (data.status === 'confirming') {
        setConfirmations(data.confirmations || 0);
      } else if (data.status === 'failed') {
        setVerifyError(data.error || 'Verification failed');
        setVerifying(false);
      }
    } catch { /* retry on next poll */ }
  }, [orderId, txHash, verifying, packsToBuy, emailBalance, saveBalance]);

  useEffect(() => {
    if (!verifying || !orderId || !txHash) return;
    const interval = setInterval(pollVerification, POLL_INTERVAL_MS);
    pollVerification();
    return () => clearInterval(interval);
  }, [verifying, orderId, txHash, pollVerification]);

  const resetModal = () => {
    setShowRecharge(false); setRechargeSuccess(null); setSelectedCrypto(null);
    setPacksToBuy(1); setOrderId(null); setTxHash(null); setPaymentSent(false);
    setVerifying(false); setConfirmations(0); setVerifyError(null); setRecharging(false);
  };

  const displayBalance = hydrated ? emailBalance : 0;

  if (compact) {
    return (
      <>
        <button onClick={() => setShowRecharge(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-accent-gold/20 to-accent-gold-light/10 border border-accent-gold/30 hover:border-accent-gold/60 transition-all group">
          <svg className="w-5 h-5 text-accent-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 0v-2m0 12v2m-4-8H6m12 0h2" />
          </svg>
          <span className="text-sm font-medium text-white tabular-nums">{(displayBalance / 1000).toFixed(0)}k</span>
          <span className="text-xs text-slate-400">emails</span>
        </button>
        {showRecharge && (
          <RechargeModal emailBalance={displayBalance} recharging={recharging} rechargeSuccess={rechargeSuccess}
            selectedCrypto={selectedCrypto} packsToBuy={packsToBuy} paymentSent={paymentSent} verifying={verifying}
            txHash={txHash} confirmations={confirmations} verifyError={verifyError}
            requiredConfirmations={REQUIRED_CONFIRMATIONS}
            onSelectCrypto={setSelectedCrypto} onPacksChange={setPacksToBuy}
            onRecharge={handleCreatePayment} onClose={resetModal} />
        )}
      </>
    );
  }

  return (
    <div className="glass-lg rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-serif text-white flex items-center gap-2">
          <svg className="w-6 h-6 text-accent-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 0v-2m0 12v2m-4-8H6m12 0h2" />
          </svg>
          Wallet
        </h2>
        <span className="px-3 py-1 rounded-full text-xs bg-accent-gold/20 text-accent-gold border border-accent-gold/30">
          {displayBalance.toLocaleString()} emails
        </span>
      </div>

      <div className="text-center mb-6">
        <div className="text-5xl font-serif font-bold text-white mb-2 tabular-nums">
          {displayBalance.toLocaleString()}
        </div>
        <p className="text-slate-400 text-sm">Available Balance</p>
        <p className="text-xs text-slate-500 mt-1">Email credits for sending campaigns</p>
      </div>

      <button onClick={() => setShowRecharge(true)}
        className="w-full rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-4 py-3 font-medium text-black transition-all hover:shadow-lg hover:shadow-accent-gold/30">
        Deposit with Crypto
      </button>

      {showRecharge && (
        <RechargeModal emailBalance={displayBalance} recharging={recharging} rechargeSuccess={rechargeSuccess}
          selectedCrypto={selectedCrypto} packsToBuy={packsToBuy} paymentSent={paymentSent} verifying={verifying}
          txHash={txHash} confirmations={confirmations} verifyError={verifyError}
          requiredConfirmations={REQUIRED_CONFIRMATIONS}
          onSelectCrypto={setSelectedCrypto} onPacksChange={setPacksToBuy}
          onRecharge={handleCreatePayment} onClose={resetModal} />
      )}
    </div>
  );
}

function RechargeModal({
  emailBalance, recharging, rechargeSuccess, selectedCrypto, packsToBuy, paymentSent,
  verifying, txHash, confirmations, verifyError, requiredConfirmations,
  onSelectCrypto, onPacksChange, onRecharge, onClose,
}: {
  emailBalance: number; recharging: boolean; rechargeSuccess: string | null;
  selectedCrypto: string | null; packsToBuy: number; paymentSent: boolean;
  verifying: boolean; txHash: string | null; confirmations: number;
  verifyError: string | null; requiredConfirmations: number;
  onSelectCrypto: (id: string) => void; onPacksChange: (packs: number) => void;
  onRecharge: () => void; onClose: () => void;
}) {
  const totalEmails = packsToBuy * EMAILS_PER_PACK;
  const totalPrice = packsToBuy * PRICE_PER_PACK;
  const selectedCryptoData = CRYPTO_OPTIONS.find(c => c.id === selectedCrypto);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => { if (!recharging && !verifying) onClose(); }}>
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-background-secondary to-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h3 className="text-xl font-serif text-white mb-2">Deposit with Crypto</h3>
        <p className="text-sm text-slate-400 mb-6">
          Balance: <span className="text-accent-gold font-bold tabular-nums">{emailBalance.toLocaleString()} emails</span>
        </p>

        {rechargeSuccess ? (
          <div className={`p-6 rounded-lg text-center ${rechargeSuccess.includes('✅') ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
            <p className="text-lg mb-2">{rechargeSuccess.includes('✅') ? '✅' : '❌'}</p>
            <p className="font-medium">{rechargeSuccess}</p>
          </div>
        ) : verifying && txHash ? (
          <div className="text-center">
            <div className="mb-6 p-4 rounded-lg bg-accent-gold/10 border border-accent-gold/20">
              <p className="text-sm text-slate-400 mb-2">🔍 Checking blockchain for transaction</p>
              <p className="text-xs text-slate-500 font-mono break-all mb-4">{txHash}</p>
              <div className="flex items-center justify-center gap-3 mb-4">
                {Array.from({ length: requiredConfirmations }).map((_, i) => (
                  <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    i < confirmations ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : i === confirmations ? 'bg-accent-gold/20 text-accent-gold border-2 border-accent-gold animate-pulse'
                    : 'bg-white/5 text-slate-600 border border-white/10'
                  }`}>{i < confirmations ? '✓' : i + 1}</div>
                ))}
              </div>
              <div className="flex justify-between text-sm text-slate-400">
                <span>Confirmations</span>
                <span className="font-bold text-white">{confirmations} / {requiredConfirmations}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                <div className="bg-gradient-to-r from-accent-gold to-green-400 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${(confirmations / requiredConfirmations) * 100}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-3">⛓️ Verifying on-chain...</p>
            </div>
            {verifyError && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">❌ {verifyError}</div>}
            <button onClick={onClose} className="w-full rounded-lg border border-white/10 px-4 py-3 font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all">Close</button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-3">Select amount</label>
              <div className="flex items-center gap-3">
                <button onClick={() => onPacksChange(Math.max(1, packsToBuy - 1))} disabled={packsToBuy <= 1}
                  className="w-10 h-10 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">−</button>
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-white">{totalPrice}</p>
                  <p className="text-xs text-slate-400">USD ({totalEmails.toLocaleString()} emails)</p>
                </div>
                <button onClick={() => onPacksChange(packsToBuy + 1)}
                  className="w-10 h-10 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all">+</button>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-accent-gold/10 border border-accent-gold/20">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Email credits</span>
                  <span className="text-white font-bold tabular-nums">{totalEmails.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Price</span>
                  <span className="text-accent-gold font-bold tabular-nums">${totalPrice} USD</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">${PRICE_PER_PACK} per {EMAILS_PER_PACK.toLocaleString()} credits</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-3">Pay with crypto</label>
              <div className="grid grid-cols-2 gap-2">
                {CRYPTO_OPTIONS.map((crypto) => {
                  const isSelected = selectedCrypto === crypto.id;
                  return (
                    <button key={crypto.id} onClick={() => onSelectCrypto(crypto.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 ${
                        isSelected ? `${crypto.borderColor} ${crypto.bgColor} ring-2 ring-offset-2 ring-offset-background scale-105 shadow-lg`
                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 hover:scale-[1.02]'
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

            {selectedCrypto && (
              <div className="p-4 mb-6 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-slate-400 mb-2">Send exactly</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-white">${totalPrice} USD</span>
                  <span className="text-xs text-slate-500">{selectedCryptoData?.symbol} ({selectedCryptoData?.network})</span>
                </div>
                <div className="mt-3 p-2 rounded bg-black/30 border border-white/5">
                  <p className="text-xs text-slate-500 font-mono">Wallet address provided at checkout</p>
                </div>
                <div className="mt-3 p-2 rounded bg-accent-gold/10 border border-accent-gold/20">
                  <p className="text-xs text-slate-400"><span>⛓️</span> Network: <strong className="text-accent-gold">{selectedCryptoData?.network}</strong></p>
                  <p className="text-xs text-slate-500 mt-1">⚡ Credited after 3 network confirmations</p>
                </div>
              </div>
            )}

            <button onClick={onRecharge} disabled={recharging || !selectedCrypto}
              className="w-full rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-4 py-3 font-medium text-black transition-all hover:shadow-lg hover:shadow-accent-gold/30 disabled:opacity-50 disabled:cursor-not-allowed">
              {recharging ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                `Deposit $${totalPrice} — ${totalEmails.toLocaleString()} credits`
              )}
            </button>
          </>
        )}

        <p className="text-xs text-slate-500 mt-6 text-center">🔒 Payments verified via blockchain explorers</p>
      </div>
    </div>
  );
}