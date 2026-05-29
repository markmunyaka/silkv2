/**
 * Namecheap Domain Service Implementation
 * Concrete implementation of IDomainService using Namecheap Reseller API
 */

import axios, { AxiosInstance } from 'axios';
import type {
  DomainCheckRequest,
  DomainCheckResponse,
  DomainRegistrationPayload,
  DomainRegistrationResult,
  DomainAvailabilityResult,
  NamecheapCheckResponse,
  NamecheapRegistrationResponse,
} from './domain-system-types';
import type { IDomainService } from './domain-service-interfaces';
import { ApiError, ValidationError, withTimeout, generateRequestId, normalizeDomain } from './domain-errors';

export interface NamecheapConfig {
  apiKey: string;
  apiUser: string;
  clientIp: string;
  sandboxMode?: boolean;
  timeout?: number;
}

/**
 * Namecheap Reseller API Service Implementation
 * Handles domain registration, availability checks, and management
 */
export class NamecheapDomainService implements IDomainService {
  private client: AxiosInstance;
  private config: NamecheapConfig;
  private baseUrl: string;

  constructor(config: NamecheapConfig) {
    this.config = config;
    this.baseUrl = config.sandboxMode
      ? 'https://api.sandbox.namecheap.com/api'
      : 'https://api.namecheap.com/api';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
    });
  }

  /**
   * Check domain availability with pricing information
   */
  async checkAvailability(request: DomainCheckRequest): Promise<DomainCheckResponse> {
    const requestId = generateRequestId();

    try {
      if (!request.domains || request.domains.length === 0) {
        throw new ValidationError('At least one domain is required');
      }

      if (request.domains.length > 100) {
        throw new ValidationError('Maximum 100 domains per request');
      }

      // Validate and normalize domains
      const normalizedDomains = request.domains.map((d) => normalizeDomain(d));

      // Build API query
      const params = {
        ApiUser: this.config.apiUser,
        ApiKey: this.config.apiKey,
        UserName: this.config.apiUser,
        ClientIp: this.config.clientIp,
        Command: 'namecheap.domains.check',
        DomainList: normalizedDomains.join(','),
      };

      const response = await withTimeout(
        this.client.get<NamecheapCheckResponse>('/xml/', { params }),
        15000,
        'Domain availability check timeout',
      );

      const apiData = response.data;

      if (apiData.ApiResponse.Status !== 'OK') {
        throw new ApiError(`Namecheap API error: ${apiData.ApiResponse.Errors?.Error}`);
      }

      const results: DomainAvailabilityResult[] = (apiData.ApiResponse.DomainCheckResult || []).map(
        (result) => ({
          domain: result.Domain,
          available: result.Available === 'True',
          price: this.extractPrice(result, request.includePrice),
          registrationPrice: result.RegularPrice,
          renewalPrice: result.RegularPrice, // Simplified; Namecheap may differ
          transferPrice: result.RegularPrice,
          currency: result.PremiumCurrency || 'USD',
          estimatedPriceUSD: this.convertToUSD(result.RegularPrice || 0),
        }),
      );

      return {
        status: 'success',
        results,
        ...(request.includeSuggestions && {
          suggestions: this.generateSuggestions(normalizedDomains, results),
        }),
        timestamp: new Date().toISOString(),
        requestId,
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        `Failed to check domain availability: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'AVAILABILITY_CHECK_FAILED',
        true,
      );
    }
  }

  /**
   * Register a domain with optional nameserver configuration
   */
  async registerDomain(payload: DomainRegistrationPayload): Promise<DomainRegistrationResult> {
    try {
      if (!payload.domain || !payload.workspaceId || !payload.userId) {
        throw new ValidationError('Domain, workspaceId, and userId are required');
      }

      const domain = normalizeDomain(payload.domain);
      const years = payload.durationYears || 1;

      // In real implementation, you'd validate registrant info and build full request
      const registrantParams = this.buildRegistrantParams(payload.registrantInfo || {});

      const params = {
        ApiUser: this.config.apiUser,
        ApiKey: this.config.apiKey,
        UserName: this.config.apiUser,
        ClientIp: this.config.clientIp,
        Command: 'namecheap.domains.create',
        DomainName: domain,
        Years: years.toString(),
        RegistrantFirstName: registrantParams.firstName,
        RegistrantLastName: registrantParams.lastName,
        RegistrantEmail: registrantParams.email,
        RegistrantPhone: registrantParams.phone,
        RegistrantOrganizationName: registrantParams.organization,
        RegistrantAddress1: registrantParams.address,
        RegistrantCity: registrantParams.city,
        RegistrantStateProvince: registrantParams.state,
        RegistrantPostalCode: registrantParams.postalCode,
        RegistrantCountry: registrantParams.country,
        ...(payload.customNameservers && {
          Nameserver1: payload.customNameservers[0],
          Nameserver2: payload.customNameservers[1],
          Nameserver3: payload.customNameservers[2],
          Nameserver4: payload.customNameservers[3],
        }),
        AddFreeWhoisGuard: payload.privacyEnabled ? 'yes' : 'no',
        WGEnable: payload.privacyEnabled ? 'yes' : 'no',
      };

      const response = await withTimeout(
        this.client.get<NamecheapRegistrationResponse>('/xml/', { params }),
        45000,
        'Domain registration timeout',
      );

      const apiData = response.data;

      if (apiData.ApiResponse.Status !== 'OK') {
        throw new ApiError(
          `Registration failed: ${apiData.ApiResponse.Errors?.Error}`,
          'REGISTRATION_FAILED',
          false,
        );
      }

      const cmdResp = apiData.ApiResponse.CommandResponse;

      return {
        id: `reg_${cmdResp?.OrderId || 'unknown'}`,
        domain,
        orderId: cmdResp?.OrderId?.toString(),
        registrarTransactionId: cmdResp?.TransactionId?.toString(),
        status: 'registered',
        expirationDate: this.calculateExpirationDate(years),
        nameservers: payload.customNameservers,
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        `Domain registration error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REGISTRATION_FAILED',
        true,
      );
    }
  }

  /**
   * Get registration status
   */
  async getRegistrationStatus(orderId: string): Promise<DomainRegistrationResult> {
    try {
      const params = {
        ApiUser: this.config.apiUser,
        ApiKey: this.config.apiKey,
        UserName: this.config.apiUser,
        ClientIp: this.config.clientIp,
        Command: 'namecheap.orders.getInfo',
        OrderNumber: orderId,
      };

      const response = await withTimeout(
        this.client.get<Record<string, unknown>>('/xml/', { params }),
        15000,
        'Status check timeout',
      );

      // Parse response and extract status
      // This is simplified; real implementation would parse XML response properly
      return {
        id: orderId,
        domain: 'unknown',
        orderId,
        status: 'registered',
      };
    } catch (error) {
      throw new ApiError(
        `Failed to get registration status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        true,
      );
    }
  }

  /**
   * Update nameservers
   */
  async updateNameservers(domain: string, nameservers: string[]): Promise<{ success: boolean }> {
    try {
      const normalizedDomain = normalizeDomain(domain);

      const params = {
        ApiUser: this.config.apiUser,
        ApiKey: this.config.apiKey,
        UserName: this.config.apiUser,
        ClientIp: this.config.clientIp,
        Command: 'namecheap.domains.dns.setCustom',
        DomainName: normalizedDomain,
        Nameserver1: nameservers[0],
        Nameserver2: nameservers[1],
        Nameserver3: nameservers[2],
        Nameserver4: nameservers[3],
      };

      const response = await withTimeout(
        this.client.get<NamecheapRegistrationResponse>('/xml/', { params }),
        20000,
        'Nameserver update timeout',
      );

      if (response.data.ApiResponse.Status !== 'OK') {
        throw new ApiError('Failed to update nameservers');
      }

      return { success: true };
    } catch (error) {
      throw new ApiError(
        `Failed to update nameservers: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        true,
      );
    }
  }

  /**
   * Renew domain
   */
  async renewDomain(domain: string, years: number): Promise<DomainRegistrationResult> {
    try {
      const normalizedDomain = normalizeDomain(domain);

      const params = {
        ApiUser: this.config.apiUser,
        ApiKey: this.config.apiKey,
        UserName: this.config.apiUser,
        ClientIp: this.config.clientIp,
        Command: 'namecheap.domains.renew',
        DomainName: normalizedDomain,
        Years: years.toString(),
      };

      const response = await withTimeout(
        this.client.get<NamecheapRegistrationResponse>('/xml/', { params }),
        30000,
        'Renewal timeout',
      );

      if (response.data.ApiResponse.Status !== 'OK') {
        throw new ApiError('Renewal failed');
      }

      return {
        id: `renewal_${Date.now()}`,
        domain: normalizedDomain,
        status: 'registered',
        expirationDate: this.calculateExpirationDate(years),
      };
    } catch (error) {
      throw new ApiError(
        `Renewal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        true,
      );
    }
  }

  /**
   * Set privacy protection
   */
  async setPrivacyProtection(domain: string, enabled: boolean): Promise<{ success: boolean }> {
    try {
      const normalizedDomain = normalizeDomain(domain);

      const params = {
        ApiUser: this.config.apiUser,
        ApiKey: this.config.apiKey,
        UserName: this.config.apiUser,
        ClientIp: this.config.clientIp,
        Command: enabled ? 'namecheap.domains.purchaseWhoisGuard' : 'namecheap.domains.freeWhoisGuard',
        DomainName: normalizedDomain,
      };

      const response = await withTimeout(
        this.client.get<NamecheapRegistrationResponse>('/xml/', { params }),
        20000,
        'Privacy update timeout',
      );

      if (response.data.ApiResponse.Status !== 'OK') {
        throw new ApiError('Privacy protection update failed');
      }

      return { success: true };
    } catch (error) {
      throw new ApiError(
        `Privacy protection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        true,
      );
    }
  }

  /**
   * Set auto-renewal
   */
  async setAutoRenewal(domain: string, enabled: boolean): Promise<{ success: boolean }> {
    try {
      const normalizedDomain = normalizeDomain(domain);

      const params = {
        ApiUser: this.config.apiUser,
        ApiKey: this.config.apiKey,
        UserName: this.config.apiUser,
        ClientIp: this.config.clientIp,
        Command: 'namecheap.domains.setRenewalReminder',
        DomainName: normalizedDomain,
        RenewalReminder: enabled ? '1' : '0',
      };

      const response = await withTimeout(
        this.client.get<NamecheapRegistrationResponse>('/xml/', { params }),
        20000,
        'Auto-renewal update timeout',
      );

      if (response.data.ApiResponse.Status !== 'OK') {
        throw new ApiError('Auto-renewal update failed');
      }

      return { success: true };
    } catch (error) {
      throw new ApiError(
        `Auto-renewal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        true,
      );
    }
  }

  /**
   * List domains
   */
  async listDomains(filter?: { status?: string; limit?: number }): Promise<DomainRegistrationResult[]> {
    // Placeholder: Implement domain listing based on Namecheap API
    return [];
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  private extractPrice(result: Record<string, unknown>, includePrice?: boolean): number | undefined {
    if (!includePrice) return undefined;
    return (result.RegularPrice as number) || (result.PremiumRegistrationPrice as number);
  }

  private convertToUSD(amount: number): number {
    // Simplified conversion; implement real currency conversion if needed
    return amount;
  }

  private generateSuggestions(
    domains: string[],
    results: DomainAvailabilityResult[],
  ): DomainAvailabilityResult[] {
    // Generate domain suggestions for unavailable domains
    // Implementation would add TLDs, hyphens, numbers, etc.
    return results.filter((r) => !r.available).slice(0, 5);
  }

  private buildRegistrantParams(registrantInfo: Record<string, unknown>): Record<string, string> {
    // Safely extract registrant information
    return {
      firstName: String(registrantInfo.firstName || 'User'),
      lastName: String(registrantInfo.lastName || 'Account'),
      email: String(registrantInfo.email || 'noreply@example.com'),
      phone: String(registrantInfo.phone || '+1.5555555555'),
      organization: String(registrantInfo.organization || ''),
      address: String((registrantInfo.address as any)?.street || 'Street'),
      city: String((registrantInfo.address as any)?.city || 'City'),
      state: String((registrantInfo.address as any)?.state || 'State'),
      postalCode: String((registrantInfo.address as any)?.postalCode || '00000'),
      country: String((registrantInfo.address as any)?.country || 'US'),
    };
  }

  private calculateExpirationDate(years: number): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() + years);
    return date.toISOString();
  }
}
