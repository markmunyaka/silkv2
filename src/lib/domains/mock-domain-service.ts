/**
 * Mock Domain Service for Development
 * Returns realistic mock data when real API keys aren't configured
 */

import type {
  DomainCheckRequest,
  DomainCheckResponse,
  DomainRegistrationPayload,
  DomainRegistrationResult,
  DomainAvailabilityResult,
  DomainSuggestion,
} from './domain-system-types';
import type { IDomainService } from './domain-service-interfaces';
import { generateRequestId, normalizeDomain, extractTld } from './domain-errors';

const MOCK_TLDS = ['.com', '.io', '.ai', '.app', '.dev', '.co', '.org', '.net', '.me', '.design'];
const MOCK_PRICES: Record<string, number> = {
  com: 10.99,
  io: 32.99,
  ai: 49.99,
  app: 14.99,
  dev: 12.99,
  co: 24.99,
  org: 9.99,
  net: 11.99,
  me: 19.99,
  design: 29.99,
};

function getBaseDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length >= 2) {
    return parts.slice(0, -1).join('.');
  }
  return parts[0];
}

function getTld(domain: string): string {
  const parts = domain.split('.');
  return parts.length >= 2 ? parts[parts.length - 1] : 'com';
}

function generateMockPrice(tld: string, available: boolean): number {
  return available ? (MOCK_PRICES[tld] || 14.99) : 0;
}

function isAvailable(seed: string): boolean {
  // Deterministic pseudo-random availability based on domain name
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  // ~40% of domains will be available
  return Math.abs(hash) % 10 < 4;
}

export class MockDomainService implements IDomainService {
  async checkAvailability(request: DomainCheckRequest): Promise<DomainCheckResponse> {
    const requestId = generateRequestId();

    const results: DomainAvailabilityResult[] = request.domains.map((d) => {
      const normalized = normalizeDomain(d);
      const available = isAvailable(normalized);
      const tld = getTld(normalized);

      return {
        domain: normalized,
        available,
        price: generateMockPrice(tld, available) || undefined,
        registrationPrice: generateMockPrice(tld, available) || undefined,
        renewalPrice: MOCK_PRICES[tld] || 14.99,
        currency: 'USD',
        estimatedPriceUSD: generateMockPrice(tld, available) || 0,
      };
    });

    let suggestions: DomainSuggestion[] | undefined;
    if (request.includeSuggestions) {
      const unavailable = results.filter((r) => !r.available);
      suggestions = [];

      for (const r of unavailable) {
        const base = getBaseDomain(r.domain);
        for (const tld of MOCK_TLDS) {
          const altDomain = `${base}${tld}`;
          if (!results.find((res) => res.domain === altDomain)) {
            const price = MOCK_PRICES[tld.replace('.', '')] || 14.99;
            suggestions.push({
              domain: altDomain,
              available: true,
              price,
              registrationPrice: price,
              renewalPrice: price,
            });
          }
          if (suggestions.length >= 4) break;
        }
        if (suggestions.length >= 4) break;
      }
    }

    return {
      status: 'success',
      results,
      suggestions: suggestions && suggestions.length > 0 ? suggestions : undefined,
      timestamp: new Date().toISOString(),
      requestId,
    };
  }

  async registerDomain(payload: DomainRegistrationPayload): Promise<DomainRegistrationResult> {
    return {
      id: `reg_mock_${Date.now()}`,
      domain: normalizeDomain(payload.domain),
      orderId: `ORD-${Date.now()}`,
      status: 'registered',
      expirationDate: new Date(Date.now() + 365 * 86400000).toISOString(),
      nameservers: payload.customNameservers,
    };
  }

  async getRegistrationStatus(orderId: string): Promise<DomainRegistrationResult> {
    return {
      id: orderId,
      domain: 'unknown',
      orderId,
      status: 'registered',
    };
  }

  async updateNameservers(domain: string, nameservers: string[]): Promise<{ success: boolean }> {
    return { success: true };
  }

  async renewDomain(domain: string, years: number): Promise<DomainRegistrationResult> {
    return {
      id: `renew_mock_${Date.now()}`,
      domain: normalizeDomain(domain),
      status: 'registered',
      expirationDate: new Date(Date.now() + years * 365 * 86400000).toISOString(),
    };
  }

  async setPrivacyProtection(domain: string, enabled: boolean): Promise<{ success: boolean }> {
    return { success: true };
  }

  async setAutoRenewal(domain: string, enabled: boolean): Promise<{ success: boolean }> {
    return { success: true };
  }

  async listDomains(filter?: { status?: string; limit?: number }): Promise<DomainRegistrationResult[]> {
    return [];
  }
}