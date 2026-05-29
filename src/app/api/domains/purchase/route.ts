import { NextRequest, NextResponse } from 'next/server';
import { DomainController } from '@/lib/domains/domain-controller';
import { MockDomainService } from '@/lib/domains/mock-domain-service';
import { NamecheapDomainService } from '@/lib/domains/namecheap-service';
import { generateRequestId, createApiResponse } from '@/lib/domains/domain-errors';

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

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        createApiResponse('error', undefined, {
          code: 'UNAUTHORIZED',
          message: 'User authentication required. Set x-user-id header.',
        }),
        { status: 401, headers: { 'X-Request-ID': requestId } },
      );
    }

    const body = await request.json();

    if (!body.domain || !body.workspaceId || !body.stripePaymentIntentId) {
      return NextResponse.json(
        createApiResponse('error', undefined, {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: domain, workspaceId, stripePaymentIntentId',
        }),
        { status: 400, headers: { 'X-Request-ID': requestId } },
      );
    }

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
    const apiStatus: 'success' | 'error' = response.status === 'error' ? 'error' : 'success';

    return NextResponse.json(
      createApiResponse(apiStatus, response.data, response.error),
      { status: statusCode, headers: { 'X-Request-ID': requestId } },
    );
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