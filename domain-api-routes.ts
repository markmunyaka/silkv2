/**
 * Next.js API Routes - Domain Endpoints
 * REST endpoints for domain registration and management
 *
 * Place these files in: app/api/domains/
 */

// ============================================================================
// GET /api/domains/check
// Check domain availability
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import type { DomainCheckRequest } from '@/lib/domains/domain-system-types';
import { DomainController } from '@/lib/domains/domain-controller';
import { NamecheapDomainService } from '@/lib/domains/namecheap-service';
import { CloudflareHostingService } from '@/lib/domains/cloudflare-service';
import { generateRequestId, createApiResponse } from '@/lib/domains/domain-errors';

// Initialize services (cache these in your app)
const domainService = new NamecheapDomainService({
  apiKey: process.env.NAMECHEAP_API_KEY || '',
  apiUser: process.env.NAMECHEAP_API_USER || '',
  clientIp: process.env.NAMECHEAP_CLIENT_IP || '0.0.0.0',
  sandboxMode: process.env.NAMECHEAP_SANDBOX === 'true',
});

const hostingService = new CloudflareHostingService({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
  zoneName: process.env.CLOUDFLARE_ZONE_NAME || '',
  defaultOrigin: process.env.CLOUDFLARE_DEFAULT_ORIGIN || 'origin.app.internal',
});

const controller = new DomainController(domainService, hostingService);

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const domainsParam = searchParams.get('domains');
    const includePriceParam = searchParams.get('includePrice');
    const includeSuggestionsParam = searchParams.get('includeSuggestions');

    if (!domainsParam) {
      return NextResponse.json(
        createApiResponse('error', undefined, {
          code: 'INVALID_REQUEST',
          message: 'domains query parameter is required',
          details: { received: Array.from(searchParams.keys()) },
        }),
        { status: 400, headers: { 'X-Request-ID': requestId } },
      );
    }

    // Parse domains (comma-separated)
    const domains = domainsParam
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    if (domains.length === 0) {
      return NextResponse.json(
        createApiResponse('error', undefined, {
          code: 'INVALID_REQUEST',
          message: 'At least one domain is required',
        }),
        { status: 400, headers: { 'X-Request-ID': requestId } },
      );
    }

    const checkRequest: DomainCheckRequest = {
      domains,
      includePrice: includePriceParam === 'true',
      includeSuggestions: includeSuggestionsParam === 'true',
    };

    // Check availability
    const response = await controller.checkAvailability(checkRequest, requestId);

    return NextResponse.json(createApiResponse('success', response), {
      status: 200,
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    console.error('[GET /api/domains/check]', error);

    return NextResponse.json(
      createApiResponse('error', undefined, {
        code: error instanceof Error && 'code' in error ? (error as any).code : 'API_ERROR',
        message:
          error instanceof Error ? error.message : 'Failed to check domain availability',
        retryable: true,
      }),
      { status: 500, headers: { 'X-Request-ID': requestId } },
    );
  }
}

// ============================================================================
// POST /api/domains/purchase
// Initiate domain purchase (post-Stripe payment)
// ============================================================================

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Verify authentication (add your auth middleware here)
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        createApiResponse('error', undefined, {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        }),
        { status: 401, headers: { 'X-Request-ID': requestId } },
      );
    }

    const body = await request.json();

    // Validate request body
    if (!body.domain || !body.workspaceId || !body.stripePaymentIntentId) {
      return NextResponse.json(
        createApiResponse('error', undefined, {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: domain, workspaceId, stripePaymentIntentId',
        }),
        { status: 400, headers: { 'X-Request-ID': requestId } },
      );
    }

    // Purchase domain
    const response = await controller.purchaseDomain(
      {
        domain: body.domain,
        workspaceId: body.workspaceId,
        userId,
        stripePaymentIntentId: body.stripePaymentIntentId,
        registrationYears: body.registrationYears || 1,
        autoRenewal: body.autoRenewal || false,
        privacyProtection: body.privacyProtection || false,
        registrantInfo: body.registrantInfo,
      },
      requestId,
    );

    const statusCode = response.status === 'error' ? 400 : 202;

    return NextResponse.json(createApiResponse(response.status, response.data, response.error), {
      status: statusCode,
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    console.error('[POST /api/domains/purchase]', error);

    return NextResponse.json(
      createApiResponse('error', undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to purchase domain',
      }),
      { status: 500, headers: { 'X-Request-ID': requestId } },
    );
  }
}

// ============================================================================
// GET /api/domains/[registrationId]/status
// Get domain registration status (polling endpoint)
// ============================================================================

export async function getRegistrationStatus(
  request: NextRequest,
  { params }: { params: { registrationId: string } },
) {
  const requestId = generateRequestId();

  try {
    const { registrationId } = params;

    if (!registrationId) {
      return NextResponse.json(
        createApiResponse('error', undefined, {
          code: 'INVALID_REQUEST',
          message: 'registrationId is required',
        }),
        { status: 400, headers: { 'X-Request-ID': requestId } },
      );
    }

    const response = await controller.getRegistrationStatus(registrationId, requestId);

    const statusCode = response.status === 'error' ? 404 : 200;

    return NextResponse.json(
      createApiResponse(response.status, response.data, response.error),
      {
        status: statusCode,
        headers: { 'X-Request-ID': requestId },
      },
    );
  } catch (error) {
    console.error('[GET /api/domains/[registrationId]/status]', error);

    return NextResponse.json(
      createApiResponse('error', undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get status',
      }),
      { status: 500, headers: { 'X-Request-ID': requestId } },
    );
  }
}

// ============================================================================
// Example Client-Side Usage
// ============================================================================

/**
 * TypeScript client for domain API
 *
 * Usage:
 *
 * // Check availability
 * const result = await domainClient.checkAvailability(['example.com', 'test.io']);
 *
 * // Purchase domain (after Stripe payment)
 * const purchase = await domainClient.purchaseDomain({
 *   domain: 'mycompany.com',
 *   workspaceId: 'ws_abc123',
 *   stripePaymentIntentId: 'pi_1234567890',
 *   registrantInfo: {
 *     firstName: 'John',
 *     lastName: 'Doe',
 *     email: 'john@example.com',
 *     phone: '+1.5555555555',
 *     address: {
 *       street: '123 Main St',
 *       city: 'San Francisco',
 *       state: 'CA',
 *       postalCode: '94105',
 *       country: 'US',
 *     },
 *   },
 * });
 *
 * // Poll for status
 * const status = await domainClient.getStatus(purchase.data.registrationId);
 *
 * // Clean UI integration: use response.data.status for visual state
 * if (status.data.status === 'active') {
 *   showSuccess('Domain is now active!');
 * } else if (status.data.status === 'provisioning') {
 *   showLoading('Configuring SSL and DNS...');
 * }
 */
export class DomainApiClient {
  constructor(private baseUrl: string = '/api/domains', private userId?: string) {}

  async checkAvailability(domains: string[], options?: { includePrice?: boolean; includeSuggestions?: boolean }) {
    const params = new URLSearchParams({
      domains: domains.join(','),
      ...(options?.includePrice && { includePrice: 'true' }),
      ...(options?.includeSuggestions && { includeSuggestions: 'true' }),
    });

    const response = await fetch(`${this.baseUrl}/check?${params}`, {
      method: 'GET',
      headers: this.buildHeaders(),
    });

    return response.json();
  }

  async purchaseDomain(payload: {
    domain: string;
    workspaceId: string;
    stripePaymentIntentId: string;
    registrationYears?: number;
    autoRenewal?: boolean;
    privacyProtection?: boolean;
    registrantInfo?: any;
  }) {
    const response = await fetch(`${this.baseUrl}/purchase`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });

    return response.json();
  }

  async getStatus(registrationId: string) {
    const response = await fetch(`${this.baseUrl}/${registrationId}/status`, {
      method: 'GET',
      headers: this.buildHeaders(),
    });

    return response.json();
  }

  async pollStatus(registrationId: string, options?: { maxAttempts?: number; delayMs?: number }) {
    const maxAttempts = options?.maxAttempts || 60;
    const delayMs = options?.delayMs || 5000;

    for (let i = 0; i < maxAttempts; i++) {
      const response = await this.getStatus(registrationId);

      if (['active', 'error'].includes(response.data?.status)) {
        return response;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error('Polling timeout: Domain activation took too long');
  }

  private buildHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(this.userId && { 'X-User-Id': this.userId }),
    };
  }
}
