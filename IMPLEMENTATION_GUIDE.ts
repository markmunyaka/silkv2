/**
 * IMPLEMENTATION GUIDE
 * Step-by-step integration instructions with real examples
 */

// ============================================================================
// STEP 1: Setup Database Schema
// ============================================================================

/*
In your project:

1. Create drizzle.config.ts:

import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/domains/domain-schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;

2. Run migrations:

npx drizzle-kit migrate

3. Verify tables created:

\dt  (in psql)
*/

// ============================================================================
// STEP 2: Configure Services with Dependency Injection
// ============================================================================

// src/lib/domains/service-factory.ts
import { NamecheapDomainService } from './namecheap-service';
import { CloudflareHostingService } from './cloudflare-service';
import type { IDomainService, IHostingService } from './domain-service-interfaces';

export class ServiceFactory {
  private static instances: {
    domainService?: IDomainService;
    hostingService?: IHostingService;
  } = {};

  static getDomainService(): IDomainService {
    if (!this.instances.domainService) {
      const apiKey = process.env.NAMECHEAP_API_KEY;
      const apiUser = process.env.NAMECHEAP_API_USER;
      const clientIp = process.env.NAMECHEAP_CLIENT_IP;

      if (!apiKey || !apiUser || !clientIp) {
        throw new Error('Missing Namecheap environment variables');
      }

      this.instances.domainService = new NamecheapDomainService({
        apiKey,
        apiUser,
        clientIp,
        sandboxMode: process.env.NODE_ENV === 'development',
        timeout: 30000,
      });
    }

    return this.instances.domainService;
  }

  static getHostingService(): IHostingService {
    if (!this.instances.hostingService) {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;
      const zoneName = process.env.CLOUDFLARE_ZONE_NAME;
      const defaultOrigin = process.env.CLOUDFLARE_DEFAULT_ORIGIN;

      if (!accountId || !apiToken || !zoneName || !defaultOrigin) {
        throw new Error('Missing Cloudflare environment variables');
      }

      this.instances.hostingService = new CloudflareHostingService({
        accountId,
        apiToken,
        zoneName,
        defaultOrigin,
      });
    }

    return this.instances.hostingService;
  }
}

// ============================================================================
// STEP 3: Setup API Routes
// ============================================================================

// app/api/domains/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ServiceFactory } from '@/lib/domains/service-factory';
import { DomainController } from '@/lib/domains/domain-controller';
import { generateRequestId, createApiResponse } from '@/lib/domains/domain-errors';
import type { DomainCheckRequest } from '@/lib/domains/domain-system-types';

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const searchParams = request.nextUrl.searchParams;
    const domainsParam = searchParams.get('domains');

    if (!domainsParam) {
      return NextResponse.json(
        createApiResponse('error', undefined, {
          code: 'INVALID_REQUEST',
          message: 'domains parameter is required',
        }),
        { status: 400, headers: { 'X-Request-ID': requestId } },
      );
    }

    const domains = domainsParam.split(',').map((d) => d.trim());
    const controller = new DomainController(
      ServiceFactory.getDomainService(),
      ServiceFactory.getHostingService(),
    );

    const response = await controller.checkAvailability(
      {
        domains,
        includePrice: searchParams.get('includePrice') === 'true',
        includeSuggestions: searchParams.get('includeSuggestions') === 'true',
      } as DomainCheckRequest,
      requestId,
    );

    return NextResponse.json(createApiResponse('success', response), {
      status: 200,
      headers: { 'X-Request-ID': requestId },
    });
  } catch (error) {
    console.error('[GET /api/domains/check]', error);
    return NextResponse.json(
      createApiResponse('error', undefined, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check domain availability',
      }),
      { status: 500, headers: { 'X-Request-ID': requestId } },
    );
  }
}

// app/api/domains/purchase/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs'; // or your auth provider
import { ServiceFactory } from '@/lib/domains/service-factory';
import { DomainController } from '@/lib/domains/domain-controller';
import { generateRequestId, createApiResponse } from '@/lib/domains/domain-errors';
import type { DomainPurchaseRequest } from '@/lib/domains/domain-system-types';

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        createApiResponse('error', undefined, {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        }),
        { status: 401, headers: { 'X-Request-ID': requestId } },
      );
    }

    const body = (await request.json()) as Partial<DomainPurchaseRequest>;

    const controller = new DomainController(
      ServiceFactory.getDomainService(),
      ServiceFactory.getHostingService(),
    );

    const response = await controller.purchaseDomain(
      {
        domain: body.domain || '',
        workspaceId: body.workspaceId || '',
        userId,
        stripePaymentIntentId: body.stripePaymentIntentId || '',
        registrationYears: body.registrationYears || 1,
        autoRenewal: body.autoRenewal || false,
        privacyProtection: body.privacyProtection || false,
        registrantInfo: body.registrantInfo,
      },
      requestId,
    );

    const statusCode = response.status === 'error' ? 400 : 202;
    return NextResponse.json(
      createApiResponse(response.status, response.data, response.error),
      { status: statusCode, headers: { 'X-Request-ID': requestId } },
    );
  } catch (error) {
    console.error('[POST /api/domains/purchase]', error);
    return NextResponse.json(
      createApiResponse('error', undefined, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to purchase domain',
      }),
      { status: 500, headers: { 'X-Request-ID': requestId } },
    );
  }
}

// ============================================================================
// STEP 4: Setup Background Job Processor
// ============================================================================

// lib/workers/domain-job-processor.ts
import { db } from '@/lib/db';
import { domainJobs } from '@/lib/domains/domain-schema';
import { ServiceFactory } from '@/lib/domains/service-factory';
import { DomainController } from '@/lib/domains/domain-controller';
import { eq, and, lte } from 'drizzle-orm';

export async function processDomainJobs() {
  try {
    const controller = new DomainController(
      ServiceFactory.getDomainService(),
      ServiceFactory.getHostingService(),
    );

    // Get pending jobs ready for retry
    const now = new Date();
    const pendingJobs = await db.query.domainJobs.findMany({
      where: and(eq(domainJobs.status, 'pending'), lte(domainJobs.nextRetryAt, now)),
      limit: 10,
    });

    console.log(`Processing ${pendingJobs.length} domain jobs...`);

    for (const job of pendingJobs) {
      try {
        if (job.type === 'register_domain') {
          await controller.processRegistrationJob(job.id);
        } else if (job.type === 'provision_hosting') {
          await controller.processProvisioningJob(job.id);
        }
        // Add more job types as needed
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Domain job processor error:', error);
  }
}

// Run processor in background
if (typeof window === 'undefined') {
  // Server-side only
  const processorInterval = setInterval(processDomainJobs, 30000); // Every 30 seconds

  // Cleanup on process exit
  process.on('exit', () => {
    clearInterval(processorInterval);
  });
}

// ============================================================================
// STEP 5: Create React Component for UI
// ============================================================================

// components/domain-purchase/DomainChecker.tsx
'use client';

import { useState, useCallback } from 'react';
import { DomainApiClient } from '@/lib/domains/domain-api-client';
import type { DomainCheckResponse } from '@/lib/domains/domain-system-types';

interface DomainCheckerProps {
  userId: string;
  onDomainSelected?: (domain: string, price: number) => void;
}

export function DomainChecker({ userId, onDomainSelected }: DomainCheckerProps) {
  const [searchInput, setSearchInput] = useState('');
  const [results, setResults] = useState<DomainCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const client = new DomainApiClient('/api/domains', userId);

  const handleSearch = useCallback(async () => {
    if (!searchInput.trim()) return;

    setLoading(true);
    setError('');

    try {
      const domains = [searchInput.trim(), ...generateAlternatives(searchInput.trim())];
      const response = await client.checkAvailability(domains, {
        includePrice: true,
        includeSuggestions: true,
      });

      if (response.status === 'success') {
        setResults(response.data);
      } else {
        setError(response.error?.message || 'Failed to check availability');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [searchInput, client]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Enter domain (e.g., mycompany.com)"
          className="flex-1 px-4 py-2 border rounded-lg"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check'}
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      {results && (
        <div className="space-y-4">
          <h3 className="font-semibold">Available Domains</h3>
          <div className="grid gap-3">
            {results.results.map((result) => (
              <DomainCard
                key={result.domain}
                result={result}
                onSelect={onDomainSelected}
              />
            ))}
          </div>

          {results.suggestions && results.suggestions.length > 0 && (
            <div>
              <h3 className="font-semibold">Suggestions</h3>
              <div className="grid gap-3">
                {results.suggestions.map((suggestion) => (
                  <DomainCard
                    key={suggestion.domain}
                    result={suggestion}
                    onSelect={onDomainSelected}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DomainCard({ result, onSelect }: any) {
  return (
    <div className="p-4 border rounded-lg flex justify-between items-center">
      <div>
        <div className="font-medium">{result.domain}</div>
        <div className="text-sm text-gray-600">
          {result.available ? (
            <span className="text-green-600">✓ Available</span>
          ) : (
            <span className="text-red-600">✗ Taken</span>
          )}
        </div>
      </div>
      {result.available && result.price && (
        <div className="text-right">
          <div className="font-semibold">${result.price}/year</div>
          <button
            onClick={() => onSelect?.(result.domain, result.price)}
            className="text-sm text-blue-600 hover:underline"
          >
            Select
          </button>
        </div>
      )}
    </div>
  );
}

function generateAlternatives(domain: string): string[] {
  const [name, tld] = domain.split('.');
  return [
    `${name}-io.${tld}`,
    `${name}co.${tld}`,
    `the${name}.${tld}`,
    `get${name}.${tld}`,
    `use${name}.${tld}`,
  ];
}

// ============================================================================
// STEP 6: Integrate with Stripe Checkout
// ============================================================================

// components/domain-purchase/DomainCheckout.tsx
'use client';

import { useCallback } from 'react';
import { loadStripe } from '@stripe/js';
import { DomainApiClient } from '@/lib/domains/domain-api-client';

interface DomainCheckoutProps {
  domain: string;
  price: number;
  workspaceId: string;
  userId: string;
  registrantInfo: any;
}

export async function DomainCheckout({
  domain,
  price,
  workspaceId,
  userId,
  registrantInfo,
}: DomainCheckoutProps) {
  const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);
  const client = new DomainApiClient('/api/domains', userId);

  const handleCheckout = useCallback(async () => {
    // 1. Create Stripe session
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        price,
        workspaceId,
        registrantInfo,
      }),
    });

    const { sessionId, paymentIntentId } = await response.json();

    // 2. Redirect to Stripe Checkout
    const { error } = await stripe!.redirectToCheckout({ sessionId });

    if (error) {
      console.error('Stripe error:', error);
      return;
    }

    // 3. After payment success, register domain
    const purchaseResult = await client.purchaseDomain({
      domain,
      workspaceId,
      stripePaymentIntentId: paymentIntentId,
      registrantInfo,
    });

    if (purchaseResult.status === 'processing') {
      // 4. Poll for completion
      const finalStatus = await client.pollStatus(
        purchaseResult.data.registrationId,
        { maxAttempts: 120, delayMs: 5000 }, // Poll for up to 10 minutes
      );

      if (finalStatus.data.status === 'active') {
        window.location.href = `/dashboard/domains/${domain}`;
      }
    }
  }, [domain, price, workspaceId, registrantInfo, client, stripe]);

  return (
    <button
      onClick={handleCheckout}
      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
    >
      Purchase for ${price}/year
    </button>
  );
}

// ============================================================================
// STEP 7: Setup Monitoring & Observability
// ============================================================================

// lib/observability/domain-logger.ts
import { logger } from '@/lib/logger'; // Your logging service

export function logDomainOperation(
  operation: string,
  data: {
    domain?: string;
    workspaceId?: string;
    userId?: string;
    status: 'success' | 'error' | 'warning';
    duration?: number;
    error?: Error;
  },
) {
  const level = data.status === 'error' ? 'error' : data.status === 'warning' ? 'warn' : 'info';

  logger[level]({
    message: `Domain operation: ${operation}`,
    operation,
    domain: data.domain,
    workspaceId: data.workspaceId,
    userId: data.userId,
    duration: data.duration,
    error: data.error?.message,
    stack: data.error?.stack,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// COMPLETE ENVIRONMENT SETUP
// ============================================================================

/*
.env.local

# Namecheap Configuration
NAMECHEAP_API_KEY=your_api_key_here
NAMECHEAP_API_USER=your_username_here
NAMECHEAP_CLIENT_IP=your_server_ip
NAMECHEAP_SANDBOX=false

# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ZONE_NAME=yourdomain.com
CLOUDFLARE_DEFAULT_ORIGIN=origin.app.internal

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/domain_registry

# Stripe
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Auth (Clerk, Auth0, etc.)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
*/
