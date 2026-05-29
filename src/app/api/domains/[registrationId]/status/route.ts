import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId, createApiResponse } from '@/lib/domains/domain-errors';

export async function GET(
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

    // In a full implementation, query the database for registration status
    // For now, return a mock processing status
    return NextResponse.json(
      createApiResponse('success', {
        registrationId,
        domain: 'example.com',
        status: 'provisioning',
        workspaceId: 'ws_placeholder',
        estimatedActivationTime: '5-10 minutes',
        nextCheckTimestamp: new Date(Date.now() + 2 * 60000).toISOString(),
      }),
      { status: 200, headers: { 'X-Request-ID': requestId } },
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