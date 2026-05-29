'use client';

import { useState } from 'react';
import DomainSearch from '@/components/DomainSearch';
import type { DomainResult } from '@/hooks/useDomainSearch';

export default function DomainSearchCard() {
  const [selectedDomain, setSelectedDomain] = useState<DomainResult | null>(null);

  const handleDomainSelect = (domain: string, price: number) => {
    setSelectedDomain({ domain, price, available: true, currency: 'USD', tld: domain.split('.').pop() || '' });
  };

  const formatPrice = (price: number | undefined | null): string => {
    if (!price || price === 0) return '—';
    return `$${price.toFixed(2)}`;
  };

  return (
    <section className="rounded-lg border bg-white/5 glass-lg p-6 mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
        <span>🌐</span> Domain Search
      </h2>
      <p className="text-foreground-secondary text-sm mb-6">
        Search for available domains. Compare registration & renewal pricing instantly.
      </p>

      <DomainSearch onDomainSelect={handleDomainSelect} showSuggestions={true} />

      {/* Pricing Summary Card */}
      {selectedDomain && (
        <div className="mt-6 p-5 rounded-lg bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-white/60 font-medium uppercase tracking-wider">Selected Domain</p>
              <p className="text-2xl font-bold text-white mt-1">{selectedDomain.domain}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Available
            </span>
          </div>

          {/* Price Breakdown - Clean & readable */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-black/20 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-emerald-400 text-lg font-bold">$</span>
                <span className="text-xs text-white/70 font-medium">Registration</span>
              </div>
              <p className="text-3xl font-bold text-white tracking-tight">
                {formatPrice(selectedDomain.price || selectedDomain.registrationPrice)}
              </p>
              <p className="text-xs text-white/50 mt-1">per year</p>
            </div>

            <div className="p-4 rounded-xl bg-black/20 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/70 text-lg font-bold">↻</span>
                <span className="text-xs text-white/70 font-medium">Renewal</span>
              </div>
              <p className="text-3xl font-bold text-white tracking-tight">
                {formatPrice(selectedDomain.renewalPrice || selectedDomain.price || selectedDomain.registrationPrice)}
              </p>
              <p className="text-xs text-white/50 mt-1">per year</p>
            </div>
          </div>

          {/* TLD Info */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10">
            <span className="text-xs px-2.5 py-1 rounded-md bg-white/10 text-white/80 font-medium">
              .{selectedDomain.tld}
            </span>
            <span className="text-xs text-white/50">
              Prices in {selectedDomain.currency || 'USD'} — charged annually
            </span>
          </div>
        </div>
      )}
    </section>
  );
}