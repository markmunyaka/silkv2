/**
 * useDomainSearch Hook
 * Custom React hook for domain search API integration
 * Handles API calls, loading states, and error handling
 */

'use client';

import { useState, useCallback } from 'react';

interface DomainResult {
  domain: string;
  available: boolean;
  price: number;
  currency: string;
  registrationPrice?: number;
  renewalPrice?: number;
  tld: string;
}

interface DomainSearchResponse {
  status: 'success' | 'error';
  results: DomainResult[];
  suggestions: DomainResult[];
  timestamp: string;
  requestId: string;
}

interface UseDomainSearchReturn {
  data: DomainSearchResponse | null;
  isLoading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
}

/**
 * Custom hook for domain search functionality
 * @returns Object with data, loading state, error, and search function
 */
export const useDomainSearch = (): UseDomainSearchReturn => {
  const [data, setData] = useState<DomainSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query || query.trim().length < 3) {
      setError('Query must be at least 3 characters');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Transform query into domain names
      // If no TLD provided, check with .com
      const cleanQuery = query.trim().toLowerCase();
      let domainsToCheck = [cleanQuery];
      
      // If it's a single word without a dot (no TLD), add .com
      if (!cleanQuery.includes('.')) {
        domainsToCheck = [`${cleanQuery}.com`];
      }

      // Build query string with proper encoding
      const params = new URLSearchParams();
      params.set('domains', domainsToCheck.join(','));
      params.set('includePrice', 'true');
      params.set('includeSuggestions', 'true');
      
      const apiUrl = `/api/domains/check?${params.toString()}`;

      console.log('Domain Search - Hook Debug:', {
        query,
        cleanQuery,
        domainsToCheck,
        apiUrl,
      });

      // Call the domain check API endpoint
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const apiResponse = await response.json();

      if (apiResponse.status === 'error') {
        throw new Error(apiResponse.error?.message || 'Failed to search domains');
      }

      // Transform API response to component format
      const results: DomainResult[] = apiResponse.data.results.map((result: any) => ({
        domain: result.domain,
        available: result.available,
        price: result.estimatedPriceUSD || result.price || 0,
        currency: result.currency || 'USD',
        registrationPrice: result.registrationPrice,
        renewalPrice: result.renewalPrice,
        tld: result.domain.split('.').pop() || '',
      }));

      const suggestions: DomainResult[] = (apiResponse.data.suggestions || []).map((sug: any) => ({
        domain: sug.domain,
        available: sug.available,
        price: sug.price || 0,
        currency: 'USD',
        tld: sug.domain.split('.').pop() || '',
      }));

      setData({
        status: 'success',
        results,
        suggestions,
        timestamp: apiResponse.timestamp,
        requestId: apiResponse.requestId,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Domain search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    data,
    isLoading,
    error,
    search,
  };
};
