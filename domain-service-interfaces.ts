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
  /**
   * Check domain availability with optional pricing information
   * @param request - Domain check request with list of domains
   * @returns Availability results with pricing if requested
   * @throws DomainServiceError on validation or API errors
   */
  checkAvailability(request: DomainCheckRequest): Promise<DomainCheckResponse>;

  /**
   * Register a domain and optionally configure nameservers
   * @param payload - Domain registration details
   * @returns Registration result with order ID and status
   * @throws DomainServiceError on registration failures
   */
  registerDomain(payload: DomainRegistrationPayload): Promise<DomainRegistrationResult>;

  /**
   * Get registration status and details
   * @param orderId - Registrar order ID
   * @returns Current registration status
   */
  getRegistrationStatus(orderId: string): Promise<DomainRegistrationResult>;

  /**
   * Update nameservers for a registered domain
   * @param domain - Domain name
   * @param nameservers - List of nameserver addresses
   * @returns Updated domain configuration
   */
  updateNameservers(domain: string, nameservers: string[]): Promise<{ success: boolean }>;

  /**
   * Renew a domain registration
   * @param domain - Domain name
   * @param years - Number of years to renew
   * @returns Renewal result
   */
  renewDomain(domain: string, years: number): Promise<DomainRegistrationResult>;

  /**
   * Enable/disable privacy protection for a domain
   * @param domain - Domain name
   * @param enabled - Privacy protection state
   * @returns Updated privacy settings
   */
  setPrivacyProtection(domain: string, enabled: boolean): Promise<{ success: boolean }>;

  /**
   * Enable/disable auto-renewal for a domain
   * @param domain - Domain name
   * @param enabled - Auto-renewal state
   * @returns Updated auto-renewal settings
   */
  setAutoRenewal(domain: string, enabled: boolean): Promise<{ success: boolean }>;

  /**
   * Get list of domains for a user/account
   * @param filter - Optional filter criteria
   * @returns List of registered domains
   */
  listDomains(filter?: { status?: string; limit?: number }): Promise<DomainRegistrationResult[]>;
}

/**
 * HostingService Interface
 * Abstract contract for hosting/DNS providers (Cloudflare, Vercel, AWS, etc.)
 */
export interface IHostingService {
  /**
   * Provision a custom domain for a workspace
   * Creates zone, adds custom hostname, initiates SSL certificate
   * @param request - Provisioning request details
   * @returns Provisioning result with status and verification details
   * @throws DomainServiceError on provisioning failures
   */
  provisionDomain(request: HostingProvisioningRequest): Promise<HostingProvisioningResult>;

  /**
   * Get provisioning status including SSL certificate status
   * @param domain - Domain name
   * @returns Current provisioning and SSL status
   */
  getProvisioningStatus(domain: string): Promise<HostingProvisioningResult>;

  /**
   * Get DNS validation records needed for domain verification
   * @param domain - Domain name
   * @returns DNS records (CNAME, TXT) for validation
   */
  getDnsValidationRecords(
    domain: string,
  ): Promise<{
    recordType: string;
    name: string;
    value: string;
  }[]>;

  /**
   * Verify DNS records have propagated and domain is ready
   * @param domain - Domain name
   * @returns Verification result
   */
  verifyDnsPropagation(domain: string): Promise<{ verified: boolean; details?: Record<string, unknown> }>;

  /**
   * Check SSL certificate status and details
   * @param domain - Domain name
   * @returns Certificate status and details
   */
  getSslCertificateStatus(
    domain: string,
  ): Promise<{
    status: 'pending' | 'active' | 'error';
    issuedAt?: string;
    expiresAt?: string;
    issuer?: string;
    validationErrors?: string[];
  }>;

  /**
   * Deprovision a custom domain (cleanup resources)
   * @param domain - Domain name
   * @returns Deprovisioning result
   */
  deprovisionDomain(domain: string): Promise<{ success: boolean }>;

  /**
   * Update custom domain origin/target
   * @param domain - Domain name
   * @param newOrigin - New origin endpoint
   * @returns Update result
   */
  updateOrigin(domain: string, newOrigin: string): Promise<{ success: boolean }>;

  /**
   * List all provisioned custom domains
   * @param filter - Optional filter criteria
   * @returns List of provisioned domains
   */
  listProvisionedDomains(filter?: { limit?: number; offset?: number }): Promise<HostingProvisioningResult[]>;
}

/**
 * Error Handler Interface
 * Provides error handling and retry logic
 */
export interface IErrorHandler {
  /**
   * Check if an error is retryable
   * @param error - Service error
   * @returns true if operation should be retried
   */
  isRetryable(error: DomainServiceError): boolean;

  /**
   * Calculate delay for exponential backoff
   * @param attempt - Current attempt number (0-indexed)
   * @param baseDelayMs - Initial delay in milliseconds
   * @param maxDelayMs - Maximum delay cap
   * @returns Delay in milliseconds
   */
  calculateBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number;

  /**
   * Format error for API response
   * @param error - Service error
   * @returns Formatted error object for client
   */
  formatError(error: DomainServiceError): Record<string, unknown>;
}

/**
 * DNS Validator Interface
 * Provides DNS validation and propagation checking
 */
export interface IDnsValidator {
  /**
   * Check if DNS records exist and are correct
   * @param domain - Domain name
   * @param recordType - DNS record type (A, CNAME, TXT, NS)
   * @param expectedValue - Expected record value
   * @returns Validation result
   */
  validateDnsRecord(
    domain: string,
    recordType: string,
    expectedValue: string,
  ): Promise<{ valid: boolean; actualValue?: string }>;

  /**
   * Poll DNS records until they propagate
   * @param domain - Domain name
   * @param recordType - DNS record type
   * @param expectedValue - Expected record value
   * @param maxWaitMs - Maximum wait time in milliseconds
   * @returns Propagation result
   */
  waitForDnsPropagation(
    domain: string,
    recordType: string,
    expectedValue: string,
    maxWaitMs?: number,
  ): Promise<{ propagated: boolean; attempts: number; lastCheck?: Date }>;

  /**
   * Get current DNS records for a domain
   * @param domain - Domain name
   * @returns List of current DNS records
   */
  getDnsRecords(domain: string): Promise<Array<{ type: string; name: string; value: string }>>;
}

/**
 * Transaction Manager Interface
 * Handles multi-step operations with rollback capability
 */
export interface ITransactionManager {
  /**
   * Begin a transaction
   * @returns Transaction ID
   */
  begin(): Promise<string>;

  /**
   * Commit a transaction
   * @param transactionId - Transaction ID
   */
  commit(transactionId: string): Promise<void>;

  /**
   * Rollback a transaction
   * @param transactionId - Transaction ID
   */
  rollback(transactionId: string): Promise<void>;

  /**
   * Record an operation in the transaction
   * @param transactionId - Transaction ID
   * @param operation - Operation details for rollback
   */
  recordOperation(
    transactionId: string,
    operation: {
      type: string;
      data: Record<string, unknown>;
    },
  ): Promise<void>;
}

/**
 * Service Factory Interface
 * Creates appropriate service instances based on configuration
 */
export interface IServiceFactory {
  /**
   * Create domain service instance
   * @param provider - Provider name (namecheap, godaddy, etc.)
   * @returns DomainService instance
   */
  createDomainService(provider: string): IDomainService;

  /**
   * Create hosting service instance
   * @param provider - Provider name (cloudflare, vercel, aws, etc.)
   * @returns HostingService instance
   */
  createHostingService(provider: string): IHostingService;

  /**
   * Create DNS validator instance
   * @returns DNSValidator instance
   */
  createDnsValidator(): IDnsValidator;

  /**
   * Create error handler instance
   * @returns ErrorHandler instance
   */
  createErrorHandler(): IErrorHandler;
}
