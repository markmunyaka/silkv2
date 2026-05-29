'use client';

import { useState, useCallback } from 'react';

export interface DomainResult {
  domain: string;
  available: boolean;
  price: number;
  currency: string;
  registrationPrice?: number;
  renewalPrice?: number;
  tld: string;
}

export interface DomainSearchResponse {
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
 * Calls /api/domains/check endpoint with proper params
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
      const cleanQuery = query.trim().toLowerCase();
      let domainsToCheck: string[];

      // If it contains a dot, treat as a full domain, otherwise add .com
      if (cleanQuery.includes('.')) {
        domainsToCheck = [cleanQuery];
      } else {
        domainsToCheck = [`${cleanQuery}.com`];
      }

      const params = new URLSearchParams();
      params.set('domains', domainsToCheck.join(','));
      params.set('includePrice', 'true');
      params.set('includeSuggestions', 'true');

      const apiUrl = `/api/domains/check?${params.toString()}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const apiResponse = await response.json();

      // Handle the wrapped API response { status, data, ... }
      const responseData = apiResponse.data || apiResponse;

      if (responseData.status === 'error') {
        throw new Error(responseData.error?.message || 'Failed to search domains');
      }

      const results: DomainResult[] = (responseData.results || []).map((result: any) => ({
        domain: result.domain,
        available: result.available,
        price: result.estimatedPriceUSD || result.price || 0,
        currency: result.currency || 'USD',
        registrationPrice: result.registrationPrice,
        renewalPrice: result.renewalPrice,
        tld: result.domain.split('.').pop() || '',
      }));

      const suggestions: DomainResult[] = (responseData.suggestions || []).map((sug: any) => ({
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
        timestamp: responseData.timestamp || apiResponse.timestamp,
        requestId: responseData.requestId || apiResponse.requestId,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Domain search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, search };
};