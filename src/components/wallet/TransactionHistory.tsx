'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

interface WalletTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  amountUsd: number | null;
  crypto: string | null;
  network: string | null;
  txHash: string | null;
  walletAddress: string | null;
  status: string;
  description: string | null;
  orderId: string | null;
  createdAt: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'deposit': return '📥';
    case 'spend': return '📤';
    case 'refund': return '🔄';
    default: return '💳';
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'deposit': return 'text-emerald-400';
    case 'spend': return 'text-red-400';
    case 'refund': return 'text-accent-gold';
    default: return 'text-slate-400';
  }
}

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'completed':
      return { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    case 'pending':
      return { label: 'Pending', className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-500/10 text-red-400 border border-red-500/20' };
    default:
      return { label: status, className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' };
  }
}

function getCryptoLabel(crypto: string | null): string {
  if (!crypto) return '';
  const labels: Record<string, string> = {
    'usdt-trc20': 'USDT (TRC-20)',
    'usdt-erc20': 'USDT (ERC-20)',
    'litecoin': 'Litecoin',
    'solana': 'Solana',
  };
  return labels[crypto] || crypto;
}

function truncateHash(hash: string, maxLen = 20): string {
  if (hash.length <= maxLen) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

interface TransactionHistoryProps {
  compact?: boolean;
}

export default function TransactionHistory({ compact = false }: TransactionHistoryProps) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const perPage = compact ? 5 : 10;
  const totalPages = Math.ceil(total / perPage);

  const fetchTransactions = useCallback(async (pageNum: number) => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const offset = pageNum * perPage;
      const res = await fetch(`/api/wallet/transactions?userId=${encodeURIComponent(user.id)}&limit=${perPage}&offset=${offset}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load transactions');
      setTransactions(data.transactions);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message);
      setTransactions([]);
    }
    setLoading(false);
  }, [user?.id, perPage]);

  useEffect(() => {
    fetchTransactions(0);
  }, [fetchTransactions]);

  // Listen for balance updates to refresh
  useEffect(() => {
    const handler = () => {
      fetchTransactions(page);
    };
    window.addEventListener('email-balance-update', handler);
    return () => window.removeEventListener('email-balance-update', handler);
  }, [fetchTransactions, page]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 0 || newPage >= totalPages) return;
    setPage(newPage);
    fetchTransactions(newPage);
  };

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-sm text-red-400">⚠ {error}</p>
        <button
          onClick={() => fetchTransactions(page)}
          className="mt-3 text-xs text-accent-gold hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.02] ${compact ? '' : 'p-6'}`}>
      {!compact && (
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h3 className="text-lg font-serif text-white">Transaction History</h3>
          </div>
          {transactions.length > 0 && (
            <span className="text-xs text-slate-500">{total} total transaction{total !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {loading && transactions.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: compact ? 3 : 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-white/5 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
              <div className="h-5 bg-white/10 rounded w-16" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-10">
          <span className="text-3xl mb-3 block">📭</span>
          <p className="text-slate-400 text-sm">No transactions yet</p>
          <p className="text-slate-500 text-xs mt-1">Deposit funds to see your transaction history here</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {transactions.map((tx) => {
              const statusBadge = getStatusBadge(tx.status);
              return (
                <div
                  key={tx.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border border-white/5 hover:bg-white/[0.03] transition-all group ${compact ? 'cursor-default' : ''}`}
                >
                  {/* Type Icon */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 ${
                    tx.type === 'deposit' ? 'bg-emerald-500/10' :
                    tx.type === 'spend' ? 'bg-red-500/10' :
                    'bg-accent-gold/10'
                  }`}>
                    {getTypeIcon(tx.type)}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-white font-medium capitalize">
                        {tx.description || `${tx.type}${tx.crypto ? ` via ${getCryptoLabel(tx.crypto)}` : ''}`}
                      </p>
                    </div>

                    {/* Crypto details */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs font-semibold tabular-nums ${getTypeColor(tx.type)}`}>
                        {tx.type === 'deposit' ? '+' : tx.type === 'spend' ? '-' : ''}
                        {tx.amount.toLocaleString()} credits
                      </span>
                      {tx.amountUsd && (
                        <span className="text-xs text-slate-500">(${tx.amountUsd.toFixed(2)} USD)</span>
                      )}
                      <span className="text-xs text-slate-600">•</span>
                      <span className="text-xs text-slate-500">{formatDate(tx.createdAt)}</span>
                    </div>

                    {/* TX Hash if present */}
                    {tx.txHash && (
                      <p className="text-[10px] text-slate-600 mt-1 font-mono truncate max-w-[300px]">
                        TX: {truncateHash(tx.txHash)}
                      </p>
                    )}
                  </div>

                  {/* Status / Amount */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs font-bold tabular-nums ${tx.type === 'deposit' ? 'text-emerald-400' : tx.type === 'spend' ? 'text-red-400' : 'text-accent-gold'}`}>
                      {tx.type === 'deposit' ? '+' : tx.type === 'spend' ? '-' : ''}
                      {tx.amount.toLocaleString()}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge.className}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5 pt-4 border-t border-white/5">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                ← Prev
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    className={`w-7 h-7 text-xs rounded-lg transition-all ${
                      i === page
                        ? 'bg-accent-gold text-black font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}