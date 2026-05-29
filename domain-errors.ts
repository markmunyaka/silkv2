/**
 * Error Handling & Utilities
 * Custom error classes, error handler, and utility functions
 */

import type { DomainServiceError } from './domain-system-types';
import { randomUUID } from 'crypto';

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

/**
 * Base error class for domain service operations
 */
export class DomainServiceException extends Error {
  readonly code: DomainServiceError['code'];
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
  readonly timestamp: Date;

  constructor(
    code: DomainServiceError['code'],
    message: string,
    retryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.details = details;
    this.timestamp = new Date();
    Object.setPrototypeOf(this, DomainServiceException.prototype);
  }

  toServiceError(): DomainServiceError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

/**
 * Validation error for invalid inputs
 */
export class ValidationError extends DomainServiceException {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_DOMAIN', message, false, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * API communication error (retryable by default)
 */
export class ApiError extends DomainServiceException {
  constructor(
    message: string,
    code: DomainServiceError['code'] = 'API_ERROR',
    retryable: boolean = true,
    details?: Record<string, unknown>,
  ) {
    super(code, message, retryable, details);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Timeout error (retryable)
 */
export class TimeoutError extends DomainServiceException {
  constructor(message: string, details?: Record<string, unknown>) {
    super('TIMEOUT', message, true, details);
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Rate limiting error (retryable with backoff)
 */
export class RateLimitError extends DomainServiceException {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number = 60, details?: Record<string, unknown>) {
    super('RATE_LIMITED', message, true, { ...details, retryAfterSeconds });
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

// ============================================================================
// ERROR HANDLER IMPLEMENTATION
// ============================================================================

export class DomainErrorHandler {
  /**
   * Check if error is retryable based on type and configuration
   */
  isRetryable(error: DomainServiceError | unknown): boolean {
    if (error instanceof DomainServiceException) {
      return error.retryable;
    }
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      return true; // Network errors are retryable
    }
    return false;
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  calculateBackoffDelay(
    attempt: number,
    baseDelayMs: number = 1000,
    maxDelayMs: number = 30000,
  ): number {
    // Exponential backoff: baseDelay * 2^attempt
    let delay = baseDelayMs * Math.pow(2, Math.min(attempt, 6)); // Cap at 6 attempts to avoid overflow
    // Add jitter: ±10% randomness to prevent thundering herd
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    const finalDelay = Math.min(delay + jitter, maxDelayMs);
    return Math.max(1000, Math.ceil(finalDelay)); // Minimum 1 second
  }

  /**
   * Format error for API response
   */
  formatError(error: DomainServiceError | unknown): Record<string, unknown> {
    if (error instanceof DomainServiceException) {
      return {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        timestamp: error.timestamp.toISOString(),
        ...(error.details && { details: error.details }),
      };
    }

    if (error instanceof Error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        retryable: false,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      retryable: false,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Log error with context
   */
  logError(
    error: unknown,
    context: {
      operation: string;
      domain?: string;
      userId?: string;
      workspaceId?: string;
      requestId?: string;
    },
  ): void {
    const timestamp = new Date().toISOString();
    const level = this.isRetryable(error) ? 'WARN' : 'ERROR';

    const errorData = {
      timestamp,
      level,
      operation: context.operation,
      domain: context.domain,
      userId: context.userId,
      workspaceId: context.workspaceId,
      requestId: context.requestId,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    };

    // Log to your observability platform (DataDog, New Relic, Sentry, etc.)
    console.error(JSON.stringify(errorData));
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate unique request IDs for tracing
 */
export function generateRequestId(): string {
  return `dom_${randomUUID()}`;
}

/**
 * Validate domain name format (basic validation)
 * @param domain - Domain to validate
 * @returns true if domain appears valid
 */
export function isValidDomain(domain: string): boolean {
  // Basic domain validation: must have at least one dot, valid characters
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  return domainRegex.test(domain);
}

/**
 * Validate registrant information structure
 */
export function isValidRegistrantInfo(info: unknown): boolean {
  if (!info || typeof info !== 'object') return false;
  const reg = info as Record<string, unknown>;
  return !!(
    reg.firstName &&
    reg.lastName &&
    reg.email &&
    reg.phone &&
    reg.address &&
    typeof reg.address === 'object'
  );
}

/**
 * Normalize domain name (lowercase, trim)
 */
export function normalizeDomain(domain: string): string {
  return domain.toLowerCase().trim();
}

/**
 * Extract TLD from domain
 */
export function extractTld(domain: string): string {
  const parts = domain.split('.');
  return parts[parts.length - 1];
}

/**
 * Create UUID-like ID for records (shorter than full UUID)
 */
export function generateId(prefix: string = ''): string {
  const id = randomUUID().replace(/-/g, '').substring(0, 12);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Format price for display
 */
export function formatPrice(amount: number | undefined, currency: string = 'USD'): string | null {
  if (!amount) return null;
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  });
  return formatter.format(amount);
}

/**
 * Wait for specified time (promise-based sleep)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 5,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000,
): Promise<T> {
  const errorHandler = new DomainErrorHandler();
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!errorHandler.isRetryable(error) || attempt === maxAttempts - 1) {
        throw error;
      }

      const delay = errorHandler.calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Create timeout promise that rejects after specified time
 */
export function createTimeout(ms: number, message: string = 'Operation timeout'): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(message));
    }, ms);
  });
}

/**
 * Race operation against timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timeout',
): Promise<T> {
  return Promise.race([promise, createTimeout(timeoutMs, timeoutMessage)]);
}

/**
 * Batch array into chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Create API response wrapper
 */
export function createApiResponse<T>(
  status: 'success' | 'error',
  data?: T,
  error?: Record<string, unknown>,
  requestId?: string,
): Record<string, unknown> {
  const response: Record<string, unknown> = {
    status,
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
  };

  if (status === 'success' && data !== undefined) {
    response.data = data;
  }

  if (status === 'error' && error) {
    response.error = error;
  }

  return response;
}

/**
 * Parse API error response from registrar/hosting provider
 */
export function parseApiErrorResponse(
  response: Record<string, unknown>,
  defaultMessage: string = 'API request failed',
): { code: string; message: string; details?: Record<string, unknown> } {
  // Handle various API error response formats
  if (response.ApiResponse && typeof response.ApiResponse === 'object') {
    const apiResp = response.ApiResponse as Record<string, unknown>;
    if (apiResp.Errors) {
      return {
        code: 'API_ERROR',
        message: String(apiResp.Errors),
        details: { apiResponse: apiResp },
      };
    }
  }

  if (response.errors && Array.isArray(response.errors)) {
    const firstError = response.errors[0] as Record<string, unknown>;
    return {
      code: String(firstError.code || 'API_ERROR'),
      message: String(firstError.message || defaultMessage),
      details: { errors: response.errors },
    };
  }

  if (response.error) {
    return {
      code: String(response.error) || 'API_ERROR',
      message: String(response.message || defaultMessage),
      details: response,
    };
  }

  return {
    code: 'API_ERROR',
    message: defaultMessage,
    details: response,
  };
}
