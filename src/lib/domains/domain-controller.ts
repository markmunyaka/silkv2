/**
 * Domain Controller
 * Orchestrates domain registration, provisioning, and management workflows
 */

import type {
  DomainCheckRequest,
  DomainCheckResponse,
  DomainPurchaseRequest,
  DomainPurchaseResponse,
} from './domain-system-types';
import type { IDomainService, IHostingService } from './domain-service-interfaces';
import {
  DomainServiceException,
  DomainErrorHandler,
  generateRequestId,
  generateId,
  createApiResponse,
  retryWithBackoff,
} from './domain-errors';

export class DomainController {
  private errorHandler: DomainErrorHandler;

  constructor(
    private domainService: IDomainService,
    private hostingService: IHostingService,
  ) {
    this.errorHandler = new DomainErrorHandler();
  }

  async checkAvailability(request: DomainCheckRequest, requestId?: string): Promise<DomainCheckResponse> {
    requestId = requestId || generateRequestId();

    try {
      const response = await retryWithBackoff(
        () => this.domainService.checkAvailability(request),
        3,
        500,
        5000,
      );

      return {
        ...response,
        requestId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.errorHandler.logError(error, {
        operation: 'checkAvailability',
        requestId,
      });
      throw error;
    }
  }

  async purchaseDomain(
    request: DomainPurchaseRequest,
    requestId?: string,
  ): Promise<DomainPurchaseResponse> {
    requestId = requestId || generateRequestId();

    try {
      if (!request.domain || !request.workspaceId || !request.userId) {
        return {
          status: 'error',
          data: {
            registrationId: '',
            domain: request.domain || '',
            status: 'error' as const,
            workspaceId: request.workspaceId || '',
          },
          error: {
            code: 'INVALID_DOMAIN',
            message: 'Missing required fields: domain, workspaceId, userId',
          },
          timestamp: new Date().toISOString(),
          requestId,
        };
      }

      const registrationId = generateId('reg');

      // Attempt domain registration
      const result = await retryWithBackoff(
        () =>
          this.domainService.registerDomain({
            domain: request.domain,
            workspaceId: request.workspaceId,
            userId: request.userId,
            durationYears: request.registrationYears ?? 1,
            autoRenewal: request.autoRenewal ?? false,
            privacyEnabled: request.privacyProtection ?? false,
            registrantInfo: request.registrantInfo,
          }),
        3,
        2000,
        30000,
      );

      if (result.status === 'failed') {
        return {
          status: 'error',
          data: {
            registrationId,
            domain: request.domain,
            status: 'error' as const,
            workspaceId: request.workspaceId,
          },
          error: {
            code: 'REGISTRATION_FAILED',
            message: result.error || 'Domain registration failed',
          },
          timestamp: new Date().toISOString(),
          requestId,
        };
      }

      return {
        status: 'processing',
        data: {
          registrationId,
          domain: request.domain,
          status: 'pending_registration',
          workspaceId: request.workspaceId,
          estimatedActivationTime: '15-30 minutes',
          nextCheckTimestamp: new Date(Date.now() + 5 * 60000).toISOString(),
        },
        timestamp: new Date().toISOString(),
        requestId,
      };
    } catch (error) {
      this.errorHandler.logError(error, {
        operation: 'purchaseDomain',
        domain: request.domain,
        workspaceId: request.workspaceId,
        userId: request.userId,
        requestId,
      });

      const err = error instanceof DomainServiceException
        ? error.toServiceError()
        : { code: 'UNKNOWN_ERROR' as const, message: error instanceof Error ? error.message : 'Failed to purchase domain' };

      return {
        status: 'error',
        data: {
          registrationId: '',
          domain: request.domain || '',
          status: 'error' as const,
          workspaceId: request.workspaceId || '',
        },
        error: { code: err.code, message: err.message },
        timestamp: new Date().toISOString(),
        requestId,
      };
    }
  }
}