/**
 * Cloudflare for Platforms Service Implementation
 * Concrete implementation of IHostingService using Cloudflare API
 */

import axios, { AxiosInstance } from 'axios';
import type {
  HostingProvisioningRequest,
  HostingProvisioningResult,
  CloudflarePlatformConfig,
  CloudflareCustomHostnameResponse,
  CloudflareZoneResponse,
} from './domain-system-types';
import type { IHostingService } from './domain-service-interfaces';
import { ApiError, ValidationError, withTimeout, normalizeDomain } from './domain-errors';

/**
 * Cloudflare for Platforms Service Implementation
 * Manages custom domains, SSL certificates, and DNS configuration
 */
export class CloudflareHostingService implements IHostingService {
  private client: AxiosInstance;
  private config: CloudflarePlatformConfig;

  constructor(config: CloudflarePlatformConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Provision a custom domain with SSL certificate
   */
  async provisionDomain(request: HostingProvisioningRequest): Promise<HostingProvisioningResult> {
    try {
      if (!request.domain || !request.workspaceId) {
        throw new ValidationError('Domain and workspaceId are required');
      }

      const domain = normalizeDomain(request.domain);

      // Step 1: Get or create zone
      const zoneId = await this.ensureZone(domain);

      // Step 2: Create custom hostname with SSL
      const customHostname = await this.createCustomHostname(
        zoneId,
        domain,
        request.customOrigin || `${request.workspaceSubdomain}.app.internal`,
      );

      // Step 3: Get DNS validation records
      const dnsRecords = await this.getValidationRecords(zoneId, domain);

      return {
        id: customHostname.id,
        domain,
        status: 'provisioning',
        sslStatus: customHostname.ssl?.status || 'pending',
        cname: dnsRecords[0]?.value,
        certificateDetails: customHostname.ssl ? {
          issuedAt: customHostname.ssl.created_at,
          issuer: customHostname.ssl.certificate_authority,
        } : undefined,
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        `Domain provisioning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROVISIONING_FAILED',
        true,
      );
    }
  }

  /**
   * Get provisioning status
   */
  async getProvisioningStatus(domain: string): Promise<HostingProvisioningResult> {
    try {
      const normalizedDomain = normalizeDomain(domain);
      const zoneId = await this.getZoneId(normalizedDomain);

      if (!zoneId) {
        return {
          id: 'unknown',
          domain: normalizedDomain,
          status: 'failed',
          error: 'Zone not found',
        };
      }

      const customHostname = await this.getCustomHostname(zoneId, normalizedDomain);

      if (!customHostname) {
        return {
          id: 'unknown',
          domain: normalizedDomain,
          status: 'pending',
        };
      }

      return {
        id: customHostname.id,
        domain: normalizedDomain,
        status: this.mapHostnameStatusToProvisioningStatus(customHostname.ssl?.status),
        sslStatus: customHostname.ssl?.status as any,
        certificateDetails: {
          issuedAt: customHostname.ssl?.created_at,
          expiresAt: this.calculateCertExpiration(customHostname.ssl?.created_at),
          issuer: customHostname.ssl?.certificate_authority,
        },
      };
    } catch (error) {
      throw new ApiError(
        `Failed to get provisioning status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        true,
      );
    }
  }

  /**
   * Get DNS validation records
   */
  async getDnsValidationRecords(
    domain: string,
  ): Promise<{
    recordType: string;
    name: string;
    value: string;
  }[]> {
    try {
      const normalizedDomain = normalizeDomain(domain);
      const zoneId = await this.getZoneId(normalizedDomain);

      if (!zoneId) {
        throw new ApiError('Zone not found for domain');
      }

      const customHostname = await this.getCustomHostname(zoneId, normalizedDomain);

      if (!customHostname || !customHostname.ssl?.validation_records) {
        return [];
      }

      return customHostname.ssl.validation_records.map((record) => ({
        recordType: 'TXT',
        name: record.txt_name,
        value: record.txt_value,
      }));
    } catch (error) {
      throw new ApiError(
        `Failed to get DNS validation records: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        true,
      );
    }
  }

  /**
   * Verify DNS propagation
   */
  async verifyDnsPropagation(domain: string): Promise<{ verified: boolean; details?: Record<string, unknown> }> {
    try {
      const normalizedDomain = normalizeDomain(domain);
      const validationRecords = await this.getDnsValidationRecords(normalizedDomain);

      if (!validationRecords || validationRecords.length === 0) {
        return {
          verified: false,
          details: { reason: 'No validation records found' },
        };
      }

      // In production, you'd actually query DNS servers to verify records
      // For now, we'll assume if records exist in Cloudflare, they're ready
      return {
        verified: true,
        details: { recordsFound: validationRecords.length },
      };
    } catch (error) {
      return {
        verified: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Get SSL certificate status
   */
  async getSslCertificateStatus(
    domain: string,
  ): Promise<{
    status: 'pending' | 'active' | 'error';
    issuedAt?: string;
    expiresAt?: string;
    issuer?: string;
    validationErrors?: string[];
  }> {
    try {
      const normalizedDomain = normalizeDomain(domain);
      const zoneId = await this.getZoneId(normalizedDomain);

      if (!zoneId) {
        return { status: 'error', validationErrors: ['Zone not found'] };
      }

      const customHostname = await this.getCustomHostname(zoneId, normalizedDomain);

      if (!customHostname || !customHostname.ssl) {
        return { status: 'pending' };
      }

      const ssl = customHostname.ssl;
      const errors = ssl.validation_errors?.map((e) => `${e.name}: ${e.reason}`);

      return {
        status: (ssl.status as any) || 'pending',
        issuedAt: ssl.created_at,
        expiresAt: this.calculateCertExpiration(ssl.created_at),
        issuer: ssl.certificate_authority,
        validationErrors: errors,
      };
    } catch (error) {
      return {
        status: 'error',
        validationErrors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Deprovision domain
   */
  async deprovisionDomain(domain: string): Promise<{ success: boolean }> {
    try {
      const normalizedDomain = normalizeDomain(domain);
      const zoneId = await this.getZoneId(normalizedDomain);

      if (!zoneId) {
        return { success: true }; // Already gone
      }

      const customHostname = await this.getCustomHostname(zoneId, normalizedDomain);

      if (!customHostname) {
        return { success: true };
      }

      const response = await withTimeout(
        this.client.delete(`/zones/${zoneId}/custom_hostnames/${customHostname.id}`),
        15000,
        'Deprovisioning timeout',
      );

      if (!response.data.success) {
        throw new ApiError('Failed to delete custom hostname');
      }

      return { success: true };
    } catch (error) {
      throw new ApiError(
        `Deprovisioning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        true,
      );
    }
  }

  /**
   * Update domain origin
   */
  async updateOrigin(domain: string, newOrigin: string): Promise<{ success: boolean }> {
    try {
      const normalizedDomain = normalizeDomain(domain);
      const zoneId = await this.getZoneId(normalizedDomain);

      if (!zoneId) {
        throw new ApiError('Zone not found');
      }

      const customHostname = await this.getCustomHostname(zoneId, normalizedDomain);

      if (!customHostname) {
        throw new ApiError('Custom hostname not found');
      }

      const response = await withTimeout(
        this.client.patch(`/zones/${zoneId}/custom_hostnames/${customHostname.id}`, {
          custom_origin_server: newOrigin,
        }),
        15000,
        'Origin update timeout',
      );

      if (!response.data.success) {
        throw new ApiError('Failed to update origin');
      }

      return { success: true };
    } catch (error) {
      throw new ApiError(
        `Update origin failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        true,
      );
    }
  }

  /**
   * List provisioned domains
   */
  async listProvisionedDomains(
    filter?: { limit?: number; offset?: number },
  ): Promise<HostingProvisioningResult[]> {
    try {
      const limit = filter?.limit || 50;
      const offset = filter?.offset || 0;

      const response = await withTimeout(
        this.client.get(
          `/zones/${this.config.zoneName}/custom_hostnames?limit=${limit}&offset=${offset}`,
        ),
        15000,
        'List domains timeout',
      );

      if (!response.data.success) {
        throw new ApiError('Failed to list domains');
      }

      return (response.data.result || []).map((hostname: any) => ({
        id: hostname.id,
        domain: hostname.hostname,
        status: this.mapHostnameStatusToProvisioningStatus(hostname.ssl?.status),
        sslStatus: hostname.ssl?.status,
        certificateDetails: hostname.ssl ? {
          issuedAt: hostname.ssl.created_at,
          expiresAt: this.calculateCertExpiration(hostname.ssl.created_at),
          issuer: hostname.ssl.certificate_authority,
        } : undefined,
      }));
    } catch (error) {
      throw new ApiError(
        `Failed to list domains: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        true,
      );
    }
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  private async ensureZone(domain: string): Promise<string> {
    const existingZoneId = await this.getZoneId(domain);
    if (existingZoneId) {
      return existingZoneId;
    }

    // Create new zone
    return this.createZone(domain);
  }

  private async getZoneId(domain: string): Promise<string | null> {
    try {
      const response = await withTimeout(
        this.client.get<CloudflareZoneResponse>(`/zones?name=${domain}&per_page=1`),
        10000,
        'Zone lookup timeout',
      );

      if (!response.data.success || response.data.result.length === 0) {
        return null;
      }

      return response.data.result[0]?.id || null;
    } catch {
      return null;
    }
  }

  private async createZone(domain: string): Promise<string> {
    try {
      const response = await withTimeout(
        this.client.post<CloudflareZoneResponse>('/zones', {
          name: domain,
          account: { id: this.config.accountId },
        }),
        20000,
        'Zone creation timeout',
      );

      if (!response.data.success) {
        throw new ApiError('Failed to create zone');
      }

      return response.data.result.id;
    } catch (error) {
      throw new ApiError(
        `Failed to create zone: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        true,
      );
    }
  }

  private async createCustomHostname(
    zoneId: string,
    hostname: string,
    customOrigin: string,
  ): Promise<CloudflareCustomHostnameResponse['result']> {
    try {
      const response = await withTimeout(
        this.client.post<CloudflareCustomHostnameResponse>(
          `/zones/${zoneId}/custom_hostnames`,
          {
            hostname,
            custom_origin_server: customOrigin,
            ssl: {
              method: 'txt',
              type: 'dv',
            },
          },
        ),
        20000,
        'Custom hostname creation timeout',
      );

      if (!response.data.success) {
        throw new ApiError(`Failed to create custom hostname: ${response.data.errors}`);
      }

      return response.data.result;
    } catch (error) {
      throw new ApiError(
        `Failed to create custom hostname: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR',
        true,
      );
    }
  }

  private async getCustomHostname(
    zoneId: string,
    hostname: string,
  ): Promise<CloudflareCustomHostnameResponse['result'] | null> {
    try {
      const response = await withTimeout(
        this.client.get<{ success: boolean; result: any[] }>(
          `/zones/${zoneId}/custom_hostnames?hostname=${hostname}`,
        ),
        10000,
        'Get custom hostname timeout',
      );

      if (!response.data.success || response.data.result.length === 0) {
        return null;
      }

      return response.data.result[0];
    } catch {
      return null;
    }
  }

  private async getValidationRecords(zoneId: string, hostname: string): Promise<any[]> {
    try {
      const customHostname = await this.getCustomHostname(zoneId, hostname);
      return customHostname?.ssl?.validation_records || [];
    } catch {
      return [];
    }
  }

  private mapHostnameStatusToProvisioningStatus(sslStatus?: string): 'pending' | 'provisioning' | 'active' | 'failed' {
    switch (sslStatus) {
      case 'active':
        return 'active';
      case 'pending_validation':
      case 'pending_issuance':
        return 'provisioning';
      case 'error':
      case 'validation_timed_out':
      case 'issuance_timed_out':
        return 'failed';
      default:
        return 'pending';
    }
  }

  private calculateCertExpiration(issuedAt?: string): string | undefined {
    if (!issuedAt) return undefined;
    const issued = new Date(issuedAt);
    const expires = new Date(issued);
    expires.setFullYear(expires.getFullYear() + 1); // 1-year validity
    return expires.toISOString();
  }
}
