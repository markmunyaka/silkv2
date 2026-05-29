import { NextRequest, NextResponse } from 'next/server';
import { DomainController } from '@/lib/domains/domain-controller';
import { MockDomainService } from '@/lib/domains/mock-domain-service';
import { NamecheapDomainService } from '@/lib/domains/namecheap-service';
import { generateRequestId, createApiResponse } from '@/lib/domains/domain-errors';
import type { DomainCheckRequest } from '@/lib/domains/domain-system-types';

// Use mock service by default for development, Namecheap when API keys are configured
function getDomainService() {
  const apiKey = process.env.NAMECHEAP_API_KEY;
  if (apiKey) {
    return new NamecheapDomainService({
      apiKey,
      apiUser: process.env.NAMECHEAP_API_USER || '',
      clientIp: process.env.NAMECHEAP_CLIENT_IP || '0.0.0.0',
      sandboxMode: process.env.NAMECHEAP_SANDBOX === 'true',
    });
  }
  return new MockDomainService();
}

const controller = new DomainController(getDomainService(), null as any);

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const searchParams = request.nextUrl.searchParams;
    const domainsParam = searchParams.get('domains');
    const queryParam = searchParams.get('query');
    const includePriceParam = searchParams.get('includePrice');
    const includeSuggestionsParam = searchParams.get('includeSuggestions');

    // Support both 'domains' and 'query' params for backward compatibility
    let domains: string[] = [];
    if (domainsParam) {
      domains = domainsParam.split(',').map((d) => d.trim()).filter((d) => d.length > 0);
    } else if (queryParam) {
      const cleanQuery = queryParam.trim().toLowerCase();
      domains = cleanQuery.includes('.') ? [cleanQuery] : [`${cleanQuery}.com`];
    }

    if (domains.length === 0) {
      return NextResponse.json(
        createApiResponse('error', undefined, {
          code: 'INVALID_REQUEST',
          message: 'At least one domain is required. Use ?domains=example.com or ?query=example',
        }),
        { status: 400, headers: { 'X-Request-ID': requestId } },
      );
    }

    const checkRequest: DomainCheckRequest = {
      domains,
      includePrice: includePriceParam === 'true',
      includeSuggestions: includeSuggestionsParam === 'true',
    };

    const response = await controller.checkAvailability(checkRequest, requestId);

    return NextResponse.json(
      createApiResponse('success', response),
      { status: 200, headers: { 'X-Request-ID': requestId } },
    );
  } catch (error) {
    console.error('[GET /api/domains/check]', error);

    return NextResponse.json(
      createApiResponse('error', undefined, {
        code: 'API_ERROR',
        message: error instanceof Error ? error.message : 'Failed to check domain availability',
      }),
      { status: 500, headers: { 'X-Request-ID': requestId } },
    );
  }
}