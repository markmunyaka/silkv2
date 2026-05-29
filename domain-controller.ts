/**
 * Domain Controller
 * Orchestrates domain registration, provisioning, and management workflows
 */

import { db } from '@/lib/db'; // Your database instance
import { domains, domainRegistrations, domainJobs, domainAuditLog } from './domain-schema';
import type {
  DomainCheckRequest,
  DomainCheckResponse,
  DomainPurchaseRequest,
  DomainPurchaseResponse,
  DomainRegistrationPayload,
  HostingProvisioningRequest,
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
import { eq, and } from 'drizzle-orm';

/**
 * Domain Controller
 * Handles all domain-related operations and orchestration
 */
export class DomainController {
  private errorHandler: DomainErrorHandler;

  constructor(
    private domainService: IDomainService,
    private hostingService: IHostingService,
  ) {
    this.errorHandler = new DomainErrorHandler();
  }

  /**
   * Check domain availability
   * Response is optimized for clean UI consumption
   */
  async checkAvailability(request: DomainCheckRequest, requestId?: string): Promise<DomainCheckResponse> {
    requestId = requestId || generateRequestId();

    try {
      const response = await retryWithBackoff(
        () => this.domainService.checkAvailability(request),
        3, // Max 3 attempts for availability check
        500, // Start with 500ms delay
        5000, // Max 5 second delay
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

  /**
   * Purchase a domain (post-Stripe payment)
   * Creates registration record and initiates async workflows
   */
  async purchaseDomain(
    request: DomainPurchaseRequest,
    requestId?: string,
  ): Promise<DomainPurchaseResponse> {
    requestId = requestId || generateRequestId();

    try {
      // Validate request
      if (!request.domain || !request.workspaceId || !request.userId) {
        throw new DomainServiceException(
          'INVALID_DOMAIN',
          'Missing required fields: domain, workspaceId, userId',
          false,
        );
      }

      const domainId = generateId('dom');
      const registrationId = generateId('reg');

      // Start database transaction
      const txn = await db.transaction(async (tx) => {
        // 1. Create domain record
        await tx.insert(domains).values({
          id: domainId,
          domain: request.domain,
          workspaceId: request.workspaceId,
          userId: request.userId,
          status: 'checking',
          registrationStatus: 'pending',
          hostingStatus: 'pending',
          autoRenewal: request.autoRenewal ?? false,
          privacyEnabled: request.privacyProtection ?? false,
          registrationAttempts: 0,
          hostingAttempts: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 2. Create registration record
        await tx.insert(domainRegistrations).values({
          id: registrationId,
          domainId,
          workspaceId: request.workspaceId,
          userId: request.userId,
          stripePaymentIntentId: request.stripePaymentIntentId,
          status: 'pending',
          registrationYears: request.registrationYears ?? 1,
          autoRenewal: request.autoRenewal ?? false,
          privacyProtection: request.privacyProtection ?? false,
          registrantInfo: request.registrantInfo,
          startedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 3. Create registration job
        await tx.insert(domainJobs).values({
          id: generateId('job'),
          registrationId,
          type: 'register_domain',
          status: 'pending',
          attempts: 0,
          maxAttempts: 5,
          payload: {
            domain: request.domain,
            workspaceId: request.workspaceId,
            userId: request.userId,
            registrationYears: request.registrationYears ?? 1,
            autoRenewal: request.autoRenewal ?? false,
            privacyEnabled: request.privacyProtection ?? false,
            registrantInfo: request.registrantInfo,
          },
          createdAt: new Date(),
          nextRetryAt: new Date(),
        });

        // 4. Audit log
        await tx.insert(domainAuditLog).values({
          id: generateId('audit'),
          domainId,
          action: 'created',
          newStatus: 'checking',
          details: {
            paymentIntentId: request.stripePaymentIntentId,
            requestId,
          },
          createdAt: new Date(),
        });

        return { domainId, registrationId };
      });

      return {
        status: 'processing',
        data: {
          registrationId: txn.registrationId,
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

      return {
        status: 'error',
        error: error instanceof DomainServiceException
          ? error.toServiceError()
          : {
              code: 'UNKNOWN_ERROR',
              message: error instanceof Error ? error.message : 'Failed to purchase domain',
              retryable: true,
            },
        timestamp: new Date().toISOString(),
        requestId,
      };
    }
  }

  /**
   * Get domain registration status (polling endpoint)
   */
  async getRegistrationStatus(
    registrationId: string,
    requestId?: string,
  ): Promise<DomainPurchaseResponse> {
    requestId = requestId || generateRequestId();

    try {
      const registration = await db.query.domainRegistrations.findFirst({
        where: eq(domainRegistrations.id, registrationId),
      });

      if (!registration) {
        return {
          status: 'error',
          error: {
            code: 'NOT_FOUND',
            message: 'Registration not found',
            retryable: false,
          },
          timestamp: new Date().toISOString(),
          requestId,
        };
      }

      const domain = await db.query.domains.findFirst({
        where: eq(domains.id, registration.domainId),
      });

      if (!domain) {
        return {
          status: 'error',
          error: {
            code: 'NOT_FOUND',
            message: 'Domain not found',
            retryable: false,
          },
          timestamp: new Date().toISOString(),
          requestId,
        };
      }

      // Map internal status to response status
      let responseStatus: 'pending_registration' | 'registered' | 'provisioning' | 'active' | 'error';
      if (domain.status === 'failed') {
        responseStatus = 'error';
      } else if (domain.status === 'active') {
        responseStatus = 'active';
      } else if (domain.registrationStatus === 'completed' && domain.hostingStatus === 'pending') {
        responseStatus = 'provisioning';
      } else if (domain.registrationStatus === 'completed' && domain.hostingStatus === 'active') {
        responseStatus = 'active';
      } else {
        responseStatus = 'pending_registration';
      }

      return {
        status: responseStatus === 'error' ? 'error' : 'success',
        data: {
          registrationId,
          domain: domain.domain,
          status: responseStatus,
          expirationDate: domain.expirationDate?.toISOString(),
          workspaceId: domain.workspaceId,
          estimatedActivationTime:
            responseStatus === 'active' ? undefined : domain.status === 'checking' ? '15-30 minutes' : '5-10 minutes',
          nextCheckTimestamp: new Date(Date.now() + 2 * 60000).toISOString(),
        },
        error:
          responseStatus === 'error'
            ? {
                code: domain.failureCode || 'REGISTRATION_FAILED',
                message: domain.failureReason || 'Domain registration failed',
                retryable: false,
              }
            : undefined,
        timestamp: new Date().toISOString(),
        requestId,
      };
    } catch (error) {
      this.errorHandler.logError(error, {
        operation: 'getRegistrationStatus',
        requestId,
      });

      return {
        status: 'error',
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get status',
          retryable: true,
        },
        timestamp: new Date().toISOString(),
        requestId,
      };
    }
  }

  /**
   * Process pending registration jobs
   * Called by background job processor
   */
  async processRegistrationJob(jobId: string): Promise<void> {
    try {
      const job = await db.query.domainJobs.findFirst({
        where: eq(domainJobs.id, jobId),
      });

      if (!job) throw new Error(`Job ${jobId} not found`);

      if (job.type !== 'register_domain') {
        throw new Error(`Invalid job type: ${job.type}`);
      }

      const payload = job.payload as any;

      // Register domain with retries
      const result = await retryWithBackoff(
        () =>
          this.domainService.registerDomain({
            domain: payload.domain,
            workspaceId: payload.workspaceId,
            userId: payload.userId,
            durationYears: payload.registrationYears,
            autoRenewal: payload.autoRenewal,
            privacyEnabled: payload.privacyEnabled,
            registrantInfo: payload.registrantInfo,
          }),
        5,
        2000,
        30000,
      );

      // Update domain and registration records
      await db.transaction(async (tx) => {
        const registration = await tx.query.domainRegistrations.findFirst({
          where: eq(domainRegistrations.id, job.registrationId),
        });

        if (registration) {
          const domain = await tx.query.domains.findFirst({
            where: eq(domains.id, registration.domainId),
          });

          if (domain) {
            // Update domain with registration details
            await tx
              .update(domains)
              .set({
                registrarOrderId: result.orderId,
                registrarTransactionId: result.registrarTransactionId,
                registrationStatus: 'completed',
                expirationDate: result.expirationDate ? new Date(result.expirationDate) : undefined,
                nameservers: result.nameservers,
                registrationAttempts: job.attempts + 1,
                updatedAt: new Date(),
              })
              .where(eq(domains.id, domain.id));

            // Update registration
            await tx
              .update(domainRegistrations)
              .set({
                status: 'in_progress',
                registrarOrderId: result.orderId,
                updatedAt: new Date(),
              })
              .where(eq(domainRegistrations.id, registration.id));

            // Mark job as completed and create provisioning job
            await tx
              .update(domainJobs)
              .set({
                status: 'completed',
                completedAt: new Date(),
              })
              .where(eq(domainJobs.id, jobId));

            // Create provisioning job
            await tx.insert(domainJobs).values({
              id: generateId('job'),
              registrationId: registration.id,
              type: 'provision_hosting',
              status: 'pending',
              attempts: 0,
              maxAttempts: 5,
              payload: {
                domain: payload.domain,
                workspaceId: payload.workspaceId,
                workspaceSubdomain: `${payload.workspaceId.substring(0, 8)}`,
              },
              createdAt: new Date(),
              nextRetryAt: new Date(),
            });

            // Audit
            await tx.insert(domainAuditLog).values({
              id: generateId('audit'),
              domainId: domain.id,
              action: 'registration_completed',
              previousStatus: 'checking',
              newStatus: 'registered',
              details: { orderId: result.orderId },
              createdAt: new Date(),
            });
          }
        }
      });
    } catch (error) {
      await this.handleJobError(jobId, error);
    }
  }

  /**
   * Process provisioning jobs
   * Sets up hosting and SSL
   */
  async processProvisioningJob(jobId: string): Promise<void> {
    try {
      const job = await db.query.domainJobs.findFirst({
        where: eq(domainJobs.id, jobId),
      });

      if (!job) throw new Error(`Job ${jobId} not found`);

      const payload = job.payload as HostingProvisioningRequest;

      // Provision domain with retries
      const result = await retryWithBackoff(
        () => this.hostingService.provisionDomain(payload),
        5,
        3000,
        30000,
      );

      // Update domain and registration records
      await db.transaction(async (tx) => {
        const registration = await tx.query.domainRegistrations.findFirst({
          where: eq(domainRegistrations.id, job.registrationId),
        });

        if (registration) {
          const domain = await tx.query.domains.findFirst({
            where: eq(domains.id, registration.domainId),
          });

          if (domain) {
            // Update domain with hosting details
            await tx
              .update(domains)
              .set({
                cfZoneId: result.id,
                hostingStatus: result.status === 'active' ? 'active' : 'provisioning',
                sslStatus: result.sslStatus,
                hostingAttempts: job.attempts + 1,
                updatedAt: new Date(),
              })
              .where(eq(domains.id, domain.id));

            // Mark job as completed
            await tx
              .update(domainJobs)
              .set({
                status: 'completed',
                completedAt: new Date(),
              })
              .where(eq(domainJobs.id, jobId));

            // Create DNS validation job if SSL is pending
            if (result.sslStatus === 'pending') {
              await tx.insert(domainJobs).values({
                id: generateId('job'),
                registrationId: registration.id,
                type: 'verify_dns',
                status: 'pending',
                attempts: 0,
                maxAttempts: 10,
                payload: { domain: payload.domain },
                createdAt: new Date(),
                nextRetryAt: new Date(Date.now() + 30000), // Check again in 30s
              });
            }

            // Audit
            await tx.insert(domainAuditLog).values({
              id: generateId('audit'),
              domainId: domain.id,
              action: 'hosting_provisioned',
              previousStatus: 'registered',
              newStatus: 'provisioning',
              details: { sslStatus: result.sslStatus },
              createdAt: new Date(),
            });
          }
        }
      });
    } catch (error) {
      await this.handleJobError(jobId, error);
    }
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  private async handleJobError(jobId: string, error: unknown): Promise<void> {
    try {
      const job = await db.query.domainJobs.findFirst({
        where: eq(domainJobs.id, jobId),
      });

      if (!job) return;

      const isRetryable =
        this.errorHandler.isRetryable(error) && job.attempts < job.maxAttempts - 1;

      const nextRetryAt = isRetryable
        ? new Date(Date.now() + this.errorHandler.calculateBackoffDelay(job.attempts))
        : undefined;

      await db.transaction(async (tx) => {
        // Update job
        await tx
          .update(domainJobs)
          .set({
            status: isRetryable ? 'pending' : 'failed',
            attempts: job.attempts + 1,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            nextRetryAt,
            updatedAt: new Date(),
          })
          .where(eq(domainJobs.id, jobId));

        // Update domain if final failure
        if (!isRetryable) {
          const registration = await tx.query.domainRegistrations.findFirst({
            where: eq(domainRegistrations.id, job.registrationId),
          });

          if (registration) {
            const domain = await tx.query.domains.findFirst({
              where: eq(domains.id, registration.domainId),
            });

            if (domain) {
              await tx
                .update(domains)
                .set({
                  status: 'failed',
                  failureReason:
                    error instanceof Error ? error.message : 'Job processing failed',
                  failureCode: error instanceof DomainServiceException ? error.code : 'UNKNOWN',
                  updatedAt: new Date(),
                })
                .where(eq(domains.id, domain.id));

              // Audit
              await tx.insert(domainAuditLog).values({
                id: generateId('audit'),
                domainId: domain.id,
                action: 'error_occurred',
                newStatus: 'failed',
                details: {
                  jobType: job.type,
                  error: error instanceof Error ? error.message : 'Unknown',
                },
                createdAt: new Date(),
              });
            }
          }
        }
      });

      this.errorHandler.logError(error, {
        operation: `processJob[${job.type}]`,
        requestId: jobId,
      });
    } catch (err) {
      console.error('Error handling job error:', err);
    }
  }
}
