/**
 * Domain Registration & Configuration System - Type Definitions
 * Comprehensive types for domain operations, API responses, and database models
 */

// ============================================================================
// DOMAIN SERVICE TYPES
// ============================================================================

export interface DomainAvailabilityResult {
  domain: string;
  available: boolean;
  price?: number;
  registrationPrice?: number;
  renewalPrice?: number;
  transferPrice?: number;
  currency?: string;
  estimatedPriceUSD?: number;
}

export interface DomainCheckRequest {
  domains: string[];
  includePrice?: boolean;
  includeSuggestions?: boolean;
}

export interface DomainSuggestion {
  domain: string;
  available: boolean;
  price: number;
  registrationPrice?: number;
  renewalPrice?: number;
}

export interface DomainCheckResponse {
  status: 'success' | 'partial' | 'error';
  results: DomainAvailabilityResult[];
  suggestions?: DomainSuggestion[];
  timestamp: string;
  requestId: string;
}

// ============================================================================
// DOMAIN PURCHASE & REGISTRATION TYPES
// ============================================================================

export interface DomainRegistrationPayload {
  domain: string;
  workspaceId: string;
  userId: string;
  durationYears?: number;
  autoRenewal?: boolean;
  privacyEnabled?: boolean;
  registrantInfo?: RegistrantInfo;
  customNameservers?: string[];
}

export interface RegistrantInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organization?: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export interface DomainRegistrationResult {
  id: string;
  domain: string;
  orderId?: string;
  status: 'pending' | 'registered' | 'failed' | 'processing';
  expirationDate?: string;
  nameservers?: string[];
  error?: string;
  registrarTransactionId?: string;
}

export interface DomainPurchaseRequest {
  domain: string;
  workspaceId: string;
  userId: string;
  stripePaymentIntentId: string;
  registrationYears?: number;
  autoRenewal?: boolean;
  privacyProtection?: boolean;
  registrantInfo?: RegistrantInfo;
}

export interface DomainPurchaseResponse {
  status: 'success' | 'error' | 'processing';
  data: {
    registrationId: string;
    domain: string;
    status: 'pending_registration' | 'registered' | 'provisioning' | 'active' | 'error';
    expirationDate?: string;
    workspaceId: string;
    estimatedActivationTime?: string;
    nextCheckTimestamp?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  requestId: string;
}

// ============================================================================
// HOSTING/CLOUDFLARE INTEGRATION TYPES
// ============================================================================

export interface HostingProvisioningRequest {
  domain: string;
  workspaceId: string;
  workspaceSubdomain: string;
  nameservers?: string[];
  customOrigin?: string;
}

export interface HostingProvisioningResult {
  id: string;
  domain: string;
  status: 'pending' | 'provisioning' | 'active' | 'failed';
  sslStatus?: 'pending' | 'active' | 'error';
  certificateDetails?: {
    issuedAt?: string;
    expiresAt?: string;
    issuer?: string;
  };
  cname?: string;
  error?: string;
}

export interface CloudflarePlatformConfig {
  accountId: string;
  apiToken: string;
  zoneName: string;
  defaultOrigin: string;
}

// ============================================================================
// DATABASE SCHEMA TYPES (Drizzle ORM)
// ============================================================================

export interface DatabaseDomain {
  id: string;
  domain: string;
  workspaceId: string;
  userId: string;
  status: 'available' | 'checking' | 'registered' | 'provisioning' | 'active' | 'failed' | 'expired';
  registrationStatus: 'pending' | 'processing' | 'completed' | 'failed';
  hostingStatus: 'pending' | 'provisioning' | 'active' | 'failed';
  registrarOrderId?: string;
  registrarTransactionId?: string;
  registrationDate?: Date;
  expirationDate?: Date;
  autoRenewal: boolean;
  privacyEnabled: boolean;
  nameservers?: string[];
  cfZoneId?: string;
  cfCustomNameserver?: string;
  sslStatus?: 'pending' | 'active' | 'error';
  certificateIssuedAt?: Date;
  certificateExpiresAt?: Date;
  failureReason?: string;
  failureCode?: string;
  lastStatusCheckAt?: Date;
  registrationAttempts: number;
  hostingAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseDomainRegistration {
  id: string;
  domainId: string;
  workspaceId: string;
  userId: string;
  stripePaymentIntentId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  registrarOrderId?: string;
  registrationYears: number;
  autoRenewal: boolean;
  privacyProtection: boolean;
  registrantInfo?: RegistrantInfo;
  errorCode?: string;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
  nextRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// API RESPONSE WRAPPER TYPES
// ============================================================================

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  requestId: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface DomainServiceError {
  code:
    | 'AVAILABILITY_CHECK_FAILED'
    | 'REGISTRATION_FAILED'
    | 'INVALID_DOMAIN'
    | 'INVALID_REGISTRANT_INFO'
    | 'API_ERROR'
    | 'TIMEOUT'
    | 'RATE_LIMITED'
    | 'INSUFFICIENT_BALANCE'
    | 'DUPLICATE_ORDER'
    | 'PROVISIONING_FAILED'
    | 'DNS_PROPAGATION_TIMEOUT'
    | 'UNKNOWN_ERROR';
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

// ============================================================================
// NAMECHEAP API SPECIFIC TYPES
// ============================================================================

export interface NamecheapCheckResponse {
  ApiResponse: {
    Status: 'OK' | 'ERROR';
    Errors?: {
      Error: string | string[];
    };
    DomainCheckResult?: Array<{
      Domain: string;
      Available: 'True' | 'False';
      IsPremiumDomain: 'True' | 'False';
      PremiumRegistrationPrice?: number;
      PremiumRenewalPrice?: number;
      PremiumTransferPrice?: number;
      PremiumRestorePrice?: number;
      PremiumOldPrice?: number;
      PremiumCurrency?: string;
      RegularPrice?: number;
      EapPrice?: number;
    }>;
  };
}

export interface NamecheapRegistrationResponse {
  ApiResponse: {
    Status: 'OK' | 'ERROR';
    Errors?: {
      Error: string | string[];
    };
    CommandResponse?: {
      OrderId: number;
      OrderNumber: number;
      TransactionId: number;
      ChargedAmount: number;
    };
  };
}

// ============================================================================
// CLOUDFLARE API SPECIFIC TYPES
// ============================================================================

export interface CloudflareZoneResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: {
    id: string;
    name: string;
    account: { id: string; name: string };
    plan: { id: string; name: string; price: number; currency: string };
    status: string;
    nameservers: string[];
  };
}

export interface CloudflareCustomHostnameResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: {
    id: string;
    hostname: string;
    custom_origin_server: string;
    ssl: {
      id: string;
      type: string;
      method: string;
      status: string;
      validation_records?: Array<{
        txt_name: string;
        txt_value: string;
      }>;
      created_at: string;
      certificate_authority: string;
      validation_errors?: Array<{ name: string; reason: string }>;
    };
    created_at: string;
    updated_at: string;
  };
}

// ============================================================================
// QUEUE/JOB TYPES
// ============================================================================

export interface DomainRegistrationJob {
  id: string;
  registrationId: string;
  type: 'register_domain' | 'provision_hosting' | 'verify_dns' | 'activate_ssl';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  error?: DomainServiceError;
  createdAt: Date;
  nextRetryAt?: Date;
  completedAt?: Date;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface DomainServiceConfig {
  namecheap?: {
    apiKey: string;
    apiUser: string;
    clientIp: string;
    sandboxMode?: boolean;
  };
  cloudflare?: {
    accountId: string;
    apiToken: string;
    zoneName: string;
    defaultOrigin: string;
  };
  retryConfig?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  timeouts?: {
    availability: number;
    registration: number;
    provisioning: number;
    dnsValidation: number;
  };
}
