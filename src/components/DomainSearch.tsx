'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Zap, Globe, TrendingUp, X, Loader2, CheckCircle2, XCircle, DollarSign, Info } from 'lucide-react';
import { useDomainSearch } from '@/hooks/useDomainSearch';
import type { DomainResult } from '@/hooks/useDomainSearch';

interface DomainSearchProps {
  onDomainSelect?: (domain: string, price: number) => void;
  workspaceId?: string;
  className?: string;
  showSuggestions?: boolean;
}

export const DomainSearch: React.FC<DomainSearchProps> = ({
  onDomainSelect,
  workspaceId,
  className = '',
  showSuggestions = true,
}) => {
  const [query, setQuery] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [selectedDomain, setSelectedDomain] = useState<DomainResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  const { data, isLoading, error, search } = useDomainSearch();

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (query.trim().length > 2) {
        search(query.trim());
        setShowResults(true);
      } else {
        setShowResults(false);
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, search]);

  const handleClear = useCallback(() => {
    setQuery('');
    setShowResults(false);
    setSelectedDomain(null);
  }, []);

  const handleSelectDomain = useCallback(
    (domain: DomainResult) => {
      setSelectedDomain(domain);
      onDomainSelect?.(domain.domain, domain.price);
    },
    [onDomainSelect],
  );

  return (
    <div className={`w-full ${className}`}>
      <SearchInput
        value={query}
        onChange={setQuery}
        onClear={handleClear}
        isLoading={isLoading}
      />

      {showResults && (
        <ResultsContainer
          isLoading={isLoading}
          error={error}
          results={data?.results || []}
          suggestions={data?.suggestions || []}
          selectedDomain={selectedDomain}
          onSelectDomain={handleSelectDomain}
          showSuggestions={showSuggestions}
        />
      )}

      {!showResults && query.length === 0 && (
        <EmptyState />
      )}

      {query.length > 0 && query.length <= 2 && (
        <div className="mt-4 text-center text-sm text-zinc-400">
          Type at least 3 characters to search
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// SEARCH INPUT
// ===========================================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isLoading: boolean;
}

const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, onClear, isLoading }) => {
  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
      <div className="relative bg-white/5 border border-white/10 rounded-xl px-5 py-4 backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 hover:bg-white/8 hover:border-white/20 focus-within:bg-white/10 focus-within:border-white/30">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
            )}
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search for your perfect domain..."
            className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-lg font-light"
            autoComplete="off"
            spellCheck="false"
          />
          {value && (
            <button
              onClick={onClear}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all duration-200"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// RESULTS CONTAINER
// ===========================================================================

interface ResultsContainerProps {
  isLoading: boolean;
  error: string | null;
  results: DomainResult[];
  suggestions: DomainResult[];
  selectedDomain: DomainResult | null;
  onSelectDomain: (domain: DomainResult) => void;
  showSuggestions: boolean;
}

const ResultsContainer: React.FC<ResultsContainerProps> = ({
  isLoading,
  error,
  results,
  suggestions,
  selectedDomain,
  onSelectDomain,
  showSuggestions,
}) => {
  return (
    <div className="mt-6 space-y-6 animate-in fade-in duration-300">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonLoader key={i} />
          ))}
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <Globe className="w-3 h-3" />
            Exact Matches
          </h3>
          <div className="space-y-2">
            {results.slice(0, 3).map((domain) => (
              <DomainCard
                key={domain.domain}
                domain={domain}
                isSelected={selectedDomain?.domain === domain.domain}
                onSelect={onSelectDomain}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && showSuggestions && suggestions.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-white/5">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <TrendingUp className="w-3 h-3" />
            Similar Available
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestions.slice(0, 4).map((domain) => (
              <DomainCard
                key={domain.domain}
                domain={domain}
                isSelected={selectedDomain?.domain === domain.domain}
                onSelect={onSelectDomain}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && results.length === 0 && suggestions.length === 0 && !error && (
        <div className="p-8 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm text-center">
          <XCircle className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No domains found. Try a different search term.</p>
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// DOMAIN CARD - with clear pricing display
// ===========================================================================

interface DomainCardProps {
  domain: DomainResult;
  isSelected: boolean;
  onSelect: (domain: DomainResult) => void;
  compact?: boolean;
}

const DomainCard: React.FC<DomainCardProps> = ({ domain, isSelected, onSelect, compact = false }) => {
  const formatPrice = (price: number | undefined | null): string => {
    if (!price || price === 0) return '—';
    return `$${price.toFixed(2)}`;
  };

  return (
    <button
      onClick={() => onSelect(domain)}
      className={`w-full group relative text-left transition-all duration-300`}
    >
      <div
        className={`absolute -inset-1 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
          domain.available
            ? 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20'
            : 'bg-gradient-to-r from-zinc-500/20 to-zinc-600/20'
        }`}
      />
      <div
        className={`relative bg-white/5 border border-white/10 rounded-lg backdrop-blur-xl backdrop-saturate-150 hover:bg-white/8 hover:border-white/20 transition-all duration-300 ${
          isSelected ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/30' : ''
        } ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
      >
        {/* Domain Name & Availability */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className={`font-semibold text-white truncate ${compact ? 'text-sm' : 'text-base'}`}>
              {domain.domain}
            </h4>
            {domain.available ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] font-medium text-emerald-400">Available</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                <XCircle className="w-3 h-3 text-red-400" />
                <span className="text-[10px] font-medium text-red-400">Taken</span>
              </span>
            )}
          </div>
          {domain.available && (
            <div className="hidden sm:flex items-center px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Zap className="w-3 h-3 text-emerald-400" />
            </div>
          )}
        </div>

        {/* Pricing Section - Always visible when available */}
        {domain.available && (
          <div className="flex items-center gap-4 flex-wrap">
            {/* Registration Price */}
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-400" />
              <span className="text-sm font-bold text-white">
                {formatPrice(domain.registrationPrice || domain.price)}
              </span>
              <span className="text-[10px] text-zinc-500">/yr</span>
            </div>

            {/* Renewal Price */}
            {domain.renewalPrice && domain.renewalPrice !== (domain.registrationPrice || domain.price) && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-500">Renew:</span>
                <span className="text-xs font-medium text-zinc-300">
                  {formatPrice(domain.renewalPrice)}/yr
                </span>
              </div>
            )}

            {/* TLD badge */}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 uppercase">
              .{domain.tld}
            </span>
          </div>
        )}

        {/* For unavailable domains, show limited info */}
        {!domain.available && !compact && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 uppercase">
              .{domain.tld}
            </span>
          </div>
        )}
      </div>
    </button>
  );
};

// ===========================================================================
// SKELETON LOADER
// ===========================================================================

const SkeletonLoader: React.FC = () => {
  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded w-32" />
          <div className="h-3 bg-white/5 rounded w-24" />
        </div>
        <div className="space-y-1 text-right">
          <div className="h-4 bg-white/10 rounded w-16 ml-auto" />
          <div className="h-3 bg-white/5 rounded w-12 ml-auto" />
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// EMPTY STATE
// ===========================================================================

const EmptyState: React.FC = () => {
  return (
    <div className="mt-8 text-center">
      <div className="inline-flex p-3 rounded-full bg-white/5 border border-white/10 mb-4">
        <Globe className="w-6 h-6 text-emerald-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Find Your Perfect Domain</h3>
      <p className="text-zinc-400 text-sm max-w-sm mx-auto">
        Search for available domains instantly. See registration and renewal pricing at a glance.
      </p>
    </div>
  );
};

export default DomainSearch;