/**
 * Domain Purchase Dialog Component
 * Modal for confirming domain purchase before Stripe checkout
 */

'use client';

import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

interface DomainPurchaseDialogProps {
  domain: string;
  price: number;
  currency: string;
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (data: PurchaseFormData) => Promise<void>;
  workspaceId: string;
}

interface PurchaseFormData {
  domain: string;
  registrationYears: number;
  autoRenewal: boolean;
  privacyProtection: boolean;
}

/**
 * Dialog component for domain purchase confirmation
 */
export const DomainPurchaseDialog: React.FC<DomainPurchaseDialogProps> = ({
  domain,
  price,
  currency,
  isOpen,
  isLoading,
  onClose,
  onConfirm,
  workspaceId,
}) => {
  const [registrationYears, setRegistrationYears] = useState(1);
  const [autoRenewal, setAutoRenewal] = useState(true);
  const [privacyProtection, setPrivacyProtection] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPrice = price * registrationYears;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await onConfirm({
        domain,
        registrationYears,
        autoRenewal,
        privacyProtection,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process purchase');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="relative p-6 border-b border-white/5">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-blue-500/10" />
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Purchase Domain</h2>
              <p className="text-lg text-emerald-400 font-mono mt-2">{domain}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Registration Period */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">Registration Period</label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setRegistrationYears(year)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    registrationYears === year
                      ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                      : 'bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {year} year{year > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Options */}
          <div className="space-y-3">
            {/* Auto Renewal */}
            <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/8 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={autoRenewal}
                onChange={(e) => setAutoRenewal(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-white">Auto-Renewal</span>
                <span className="text-xs text-zinc-400">Automatically renew every year</span>
              </span>
            </label>

            {/* Privacy Protection */}
            <label className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/8 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={privacyProtection}
                onChange={(e) => setPrivacyProtection(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-white">Privacy Protection</span>
                <span className="text-xs text-zinc-400">Hide your personal information</span>
              </span>
            </label>
          </div>

          {/* Price Summary */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-300">
                {registrationYears === 1 ? 'First year' : `${registrationYears} years`}
              </span>
              <span className="text-white font-semibold">
                {currency} {totalPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10">
              <span className="text-zinc-400">Total</span>
              <span className="text-lg font-bold text-emerald-400">
                {currency} {totalPrice.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-medium hover:from-emerald-600 hover:to-blue-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Continue to Checkout
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}