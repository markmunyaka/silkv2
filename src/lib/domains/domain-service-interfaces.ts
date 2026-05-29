/**
 * Abstract Service Interfaces
 * Define contracts for domain and hosting services to allow provider swapping
 */

import type {
  DomainAvailabilityResult,
  DomainCheckRequest,
  DomainCheckResponse,
  DomainRegistrationPayload,
  DomainRegistrationResult,
  HostingProvisioningRequest,
  HostingProvisioningResult,
  DomainServiceError,
} from './domain-system-types';

/**
 * DomainService Interface
 * Abstract contract for domain registration providers (Namecheap, GoDaddy, etc.)
 */
export interface IDomainService {
  checkAvailability(request: DomainCheckRequest): Promise<DomainCheckResponse>;
  registerDomain(payload: DomainRegistrationPayload): Promise<DomainRegistrationResult>;
  getRegistrationStatus(orderId: string): Promise<DomainRegistrationResult>;
  updateNameservers(domain: string, nameservers: string[]): Promise<{ success: boolean }>;
  renewDomain(domain: string, years: number): Promise<DomainRegistrationResult>;
  setPrivacyProtection(domain: string, enabled: boolean): Promise<{ success: boolean }>;
  setAutoRenewal(domain: string, enabled: boolean): Promise<{ success: boolean }>;
  listDomains(filter?: { status?: string; limit?: number }): Promise<DomainRegistrationResult[]>;
}

/**
 * HostingService Interface
 * Abstract contract for hosting/DNS providers (Cloudflare, Vercel, AWS, etc.)
 */
export interface IHostingService {
  provisionDomain(request: HostingProvisioningRequest): Promise<HostingProvisioningResult>;
  getProvisioningStatus(domain: string): Promise<HostingProvisioningResult>;
  getDnsValidationRecords(
    domain: string,
  ): Promise<{
    recordType: string;
    name: string;
    value: string;
  }[]>;
  verifyDnsPropagation(domain: string): Promise<{ verified: boolean; details?: Record<string, unknown> }>;
  getSslCertificateStatus(
    domain: string,
  ): Promise<{
    status: 'pending' | 'active' | 'error';
    issuedAt?: string;
    expiresAt?: string;
    issuer?: string;
    validationErrors?: string[];
  }>;
  deprovisionDomain(domain: string): Promise<{ success: boolean }>;
  updateOrigin(domain: string, newOrigin: string): Promise<{ success: boolean }>;
  listProvisionedDomains(filter?: { limit?: number; offset?: number }): Promise<HostingProvisioningResult[]>;
}

/**
 * Error Handler Interface
 */
export interface IErrorHandler {
  isRetryable(error: DomainServiceError): boolean;
  calculateBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number;
  formatError(error: DomainServiceError): Record<string, unknown>;
}

/**
 * DNS Validator Interface
 */
export interface IDnsValidator {
  validateDnsRecord(
    domain: string,
    recordType: string,
    expectedValue: string,
  ): Promise<{ valid: boolean; actualValue?: string }>;
  waitForDnsPropagation(
    domain: string,
    recordType: string,
    expectedValue: string,
    maxWaitMs?: number,
  ): Promise<{ propagated: boolean; attempts: number; lastCheck?: Date }>;
  getDnsRecords(domain: string): Promise<Array<{ type: string; name: string; value: string }>>;
}

/**
 * Service Factory Interface
 */
export interface IServiceFactory {
  createDomainService(provider: string): IDomainService;
  createHostingService(provider: string): IHostingService;
  createDnsValidator(): IDnsValidator;
  createErrorHandler(): IErrorHandler;
}