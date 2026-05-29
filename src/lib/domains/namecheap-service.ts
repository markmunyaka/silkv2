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
  DomainSuggestion,
  NamecheapCheckResponse,
  NamecheapRegistrationResponse,
} from './domain-system-types';
import type { IDomainService } from './domain-service-interfaces';
import {
  ApiError,
  ValidationError,
  withTimeout,
  generateRequestId,
  normalizeDomain,
} from './domain-errors';

export interface NamecheapConfig {
  apiKey: string;
  apiUser: string;
  clientIp: string;
  sandboxMode?: boolean;
  timeout?: number;
}

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

  async checkAvailability(request: DomainCheckRequest): Promise<DomainCheckResponse> {
    const requestId = generateRequestId();

    try {
      if (!request.domains || request.domains.length === 0) {
        throw new ValidationError('At least one domain is required');
      }

      if (request.domains.length > 100) {
        throw new ValidationError('Maximum 100 domains per request');
      }

      const normalizedDomains = request.domains.map((d) => normalizeDomain(d));

      const params: Record<string, string | undefined> = {
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
        const errMsg = apiData.ApiResponse.Errors?.Error
          ? Array.isArray(apiData.ApiResponse.Errors.Error)
            ? apiData.ApiResponse.Errors.Error.join(', ')
            : apiData.ApiResponse.Errors.Error
          : 'Unknown Namecheap API error';
        throw new ApiError(`Namecheap API error: ${errMsg}`);
      }

      const results: DomainAvailabilityResult[] = (apiData.ApiResponse.DomainCheckResult || []).map(
        (result) => ({
          domain: result.Domain,
          available: result.Available === 'True',
          price: result.RegularPrice || result.PremiumRegistrationPrice || undefined,
          registrationPrice: result.RegularPrice,
          renewalPrice: result.RegularPrice,
          transferPrice: result.RegularPrice,
          currency: result.PremiumCurrency || 'USD',
          estimatedPriceUSD: result.RegularPrice || 0,
        }),
      );

      let suggestions: DomainSuggestion[] | undefined;
      if (request.includeSuggestions) {
        suggestions = results
          .filter((r): r is DomainAvailabilityResult & { price: number } => !r.available && r.price !== undefined)
          .slice(0, 5)
          .map((r) => ({
            domain: r.domain,
            available: r.available,
            price: r.price,
            registrationPrice: r.registrationPrice,
            renewalPrice: r.renewalPrice,
          }));
      }

      return {
        status: 'success',
        results,
        suggestions,
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

  async registerDomain(payload: DomainRegistrationPayload): Promise<DomainRegistrationResult> {
    try {
      if (!payload.domain || !payload.workspaceId || !payload.userId) {
        throw new ValidationError('Domain, workspaceId, and userId are required');
      }

      const domain = normalizeDomain(payload.domain);
      const years = payload.durationYears || 1;
      const r = payload.registrantInfo || {
        firstName: 'User',
        lastName: 'Account',
        email: 'noreply@example.com',
        phone: '+1.5555555555',
        address: { street: 'Street', city: 'City', state: 'State', postalCode: '00000', country: 'US' },
      };

      const params: Record<string, string | undefined> = {
        ApiUser: this.config.apiUser,
        ApiKey: this.config.apiKey,
        UserName: this.config.apiUser,
        ClientIp: this.config.clientIp,
        Command: 'namecheap.domains.create',
        DomainName: domain,
        Years: years.toString(),
        RegistrantFirstName: r.firstName,
        RegistrantLastName: r.lastName,
        RegistrantEmail: r.email,
        RegistrantPhone: r.phone,
        RegistrantOrganizationName: r.organization,
        RegistrantAddress1: r.address.street,
        RegistrantCity: r.address.city,
        RegistrantStateProvince: r.address.state,
        RegistrantPostalCode: r.address.postalCode,
        RegistrantCountry: r.address.country,
        AddFreeWhoisGuard: payload.privacyEnabled ? 'yes' : 'no',
        WGEnable: payload.privacyEnabled ? 'yes' : 'no',
      };

      if (payload.customNameservers) {
        payload.customNameservers.forEach((ns, i) => {
          params[`Nameserver${i + 1}`] = ns;
        });
      }

      const response = await withTimeout(
        this.client.get<NamecheapRegistrationResponse>('/xml/', { params }),
        45000,
        'Domain registration timeout',
      );

      const apiData = response.data;

      if (apiData.ApiResponse.Status !== 'OK') {
        const errMsg = apiData.ApiResponse.Errors?.Error
          ? Array.isArray(apiData.ApiResponse.Errors.Error)
            ? apiData.ApiResponse.Errors.Error.join(', ')
            : apiData.ApiResponse.Errors.Error
          : 'Registration failed';
        throw new ApiError(`Registration failed: ${errMsg}`, 'REGISTRATION_FAILED', false);
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

      await withTimeout(
        this.client.get<Record<string, unknown>>('/xml/', { params }),
        15000,
        'Status check timeout',
      );

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

  async updateNameservers(domain: string, nameservers: string[]): Promise<{ success: boolean }> {
    try {
      const normalizedDomain = normalizeDomain(domain);
      const params: Record<string, string | undefined> = {
        ApiUser: this.config.apiUser,
        ApiKey: this.config.apiKey,
        UserName: this.config.apiUser,
        ClientIp: this.config.clientIp,
        Command: 'namecheap.domains.dns.setCustom',
        DomainName: normalizedDomain,
      };
      nameservers.forEach((ns, i) => {
        params[`Nameserver${i + 1}`] = ns;
      });

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

  async listDomains(filter?: { status?: string; limit?: number }): Promise<DomainRegistrationResult[]> {
    return [];
  }

  private calculateExpirationDate(years: number): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() + years);
    return date.toISOString();
  }
}