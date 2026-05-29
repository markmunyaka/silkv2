/**
 * Premium Domain Search Component
 * Luxury glassmorphism design with dark mode aesthetics for Silk Summary AI
 *
 * Features:
 * - Real-time domain availability checking
 * - Premium search input with icon
 * - Skeleton loader during API calls
 * - Beautiful results display with pricing
 * - Alternative domain suggestions
 * - Fully responsive design
 * - Type-safe React with TypeScript
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Zap, Globe, TrendingUp, X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useDomainSearch } from '../../hooks-useDomainSearch';

// ===========================================================================
// TYPE DEFINITIONS
// ===========================================================================

interface DomainResult {
  domain: string;
  available: boolean;
  price: number;
  currency: string;
  registrationPrice?: number;
  renewalPrice?: number;
  tld: string;
}

interface DomainSearchProps {
  onDomainSelect?: (domain: string, price: number) => void;
  workspaceId?: string;
  className?: string;
  showSuggestions?: boolean;
}

// ===========================================================================
// MAIN DOMAIN SEARCH COMPONENT
// ===========================================================================

export const DomainSearch: React.FC<DomainSearchProps> = ({
  onDomainSelect,
  workspaceId,
  className = '',
  showSuggestions = true,
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const [selectedDomain, setSelectedDomain] = useState<DomainResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Use custom hook for API calls
  const { data, isLoading, error, search } = useDomainSearch();

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query);

      if (query.trim().length > 2) {
        search(query.trim());
        setShowResults(true);
      } else {
        setShowResults(false);
      }
    }, 500); // 500ms debounce

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
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      {/* Search Input Section */}
      <SearchInput
        value={query}
        onChange={setQuery}
        onClear={handleClear}
        isLoading={isLoading}
        hasResults={showResults && data?.results.length > 0}
      />

      {/* Results Section */}
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

      {/* Empty State */}
      {!showResults && query.length === 0 && (
        <EmptyState />
      )}

      {/* Minimal Help Text */}
      {query.length > 0 && query.length <= 2 && (
        <div className="mt-4 text-center text-sm text-zinc-400">
          Type at least 3 characters to search
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// SEARCH INPUT COMPONENT
// ===========================================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isLoading: boolean;
  hasResults: boolean;
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onClear,
  isLoading,
  hasResults,
}) => {
  return (
    <div className="relative group">
      {/* Glassmorphism background glow effect */}
      <div
        className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20
                       rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500"
      />

      {/* Input Container */}
      <div
        className="relative bg-white/5 border border-white/10 rounded-xl px-5 py-4
                   backdrop-blur-xl backdrop-saturate-150 transition-all duration-300
                   hover:bg-white/8 hover:border-white/20 focus-within:bg-white/10 focus-within:border-white/30"
      >
        {/* Icon and Input Wrapper */}
        <div className="flex items-center gap-3">
          {/* Search Icon */}
          <div className="flex-shrink-0">
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
            )}
          </div>

          {/* Input Field */}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search for your perfect domain..."
            className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-lg font-light"
            autoComplete="off"
            spellCheck="false"
          />

          {/* Clear Button */}
          {value && (
            <button
              onClick={onClear}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white
                         transition-all duration-200"
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
// RESULTS CONTAINER COMPONENT
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
      {/* Error State */}
      {error && (
        <div
          className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm
                     backdrop-blur-sm"
        >
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonLoader key={i} />
          ))}
        </div>
      )}

      {/* Results - Primary Matches */}
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

      {/* Suggestions - Alternative Extensions */}
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

      {/* No Results State */}
      {!isLoading && results.length === 0 && suggestions.length === 0 && (
        <div className="p-8 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm text-center">
          <XCircle className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No domains found. Try a different search term.</p>
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// DOMAIN CARD COMPONENT
// ===========================================================================

interface DomainCardProps {
  domain: DomainResult;
  isSelected: boolean;
  onSelect: (domain: DomainResult) => void;
  compact?: boolean;
}

const DomainCard: React.FC<DomainCardProps> = ({
  domain,
  isSelected,
  onSelect,
  compact = false,
}) => {
  return (
    <button
      onClick={() => onSelect(domain)}
      className={`w-full group relative text-left transition-all duration-300 ${
        compact ? 'py-2 px-3' : 'py-3 px-4'
      }`}
    >
      {/* Background glow on hover */}
      <div
        className={`absolute -inset-1 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
          domain.available
            ? 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20'
            : 'bg-gradient-to-r from-zinc-500/20 to-zinc-600/20'
        }`}
      />

      {/* Card content */}
      <div
        className={`relative bg-white/5 border border-white/10 rounded-lg px-4 py-3
                     backdrop-blur-xl backdrop-saturate-150 hover:bg-white/8 hover:border-white/20
                     transition-all duration-300 ${isSelected ? 'bg-emerald-500/10 border-emerald-500/30' : ''}`}
      >
        <div className={`flex items-center justify-between ${compact ? 'gap-2' : 'gap-4'}`}>
          {/* Domain Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-semibold text-white truncate">
                {domain.domain}
              </h4>
              {domain.available && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              )}
            </div>

            {!compact && (
              <p className="text-xs text-zinc-500 mt-1">
                {domain.available ? 'Available' : 'Registered'}
              </p>
            )}
          </div>

          {/* Price and Action */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {domain.price && (
              <div className="text-right">
                <div className="text-sm sm:text-base font-semibold text-white">
                  ${domain.price}
                </div>
                {!compact && (
                  <div className="text-xs text-zinc-500">/year</div>
                )}
              </div>
            )}

            {domain.available && (
              <div className="hidden sm:flex items-center px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <Zap className="w-3 h-3 text-emerald-400" />
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

// ===========================================================================
// SKELETON LOADER COMPONENT
// ===========================================================================

const SkeletonLoader: React.FC = () => {
  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded w-32" />
          <div className="h-3 bg-white/5 rounded w-24" />
        </div>
        <div className="space-y-2 text-right">
          <div className="h-4 bg-white/10 rounded w-16" />
          <div className="h-3 bg-white/5 rounded w-12" />
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// EMPTY STATE COMPONENT
// ===========================================================================

const EmptyState: React.FC = () => {
  return (
    <div className="mt-8 text-center">
      <div className="inline-flex p-3 rounded-full bg-white/5 border border-white/10 mb-4">
        <Globe className="w-6 h-6 text-emerald-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Find Your Perfect Domain</h3>
      <p className="text-zinc-400 text-sm max-w-sm mx-auto">
        Search for available domains instantly. Get pricing and suggestions for similar extensions.
      </p>
    </div>
  );
};

export default DomainSearch;
