/**
 * Domain System - Main Index
 * Export all domain system components
 */

export * from './domain-system-types';
export * from './domain-service-interfaces';
export * from './domain-errors';
export * from './namecheap-service';
export * from './cloudflare-service';
export * from './domain-controller';

// Export a convenience function to create a mock controller for development/testing
import { DomainController } from './domain-controller';
import { NamecheapDomainService } from './namecheap-service';
import { CloudflareHostingService } from './cloudflare-service';
import type { DomainServiceConfig } from './domain-system-types';

/**
 * Create a configured DomainController with environment-based settings
 */
export function createDomainController(config?: Partial<DomainServiceConfig>): DomainController {
  const domainService = new NamecheapDomainService({
    apiKey: process.env.NAMECHEAP_API_KEY || config?.namecheap?.apiKey || '',
    apiUser: process.env.NAMECHEAP_API_USER || config?.namecheap?.apiUser || '',
    clientIp: process.env.NAMECHEAP_CLIENT_IP || config?.namecheap?.clientIp || '0.0.0.0',
    sandboxMode: process.env.NAMECHEAP_SANDBOX === 'true' || config?.namecheap?.sandboxMode || false,
  });

  const hostingService = new CloudflareHostingService({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || config?.cloudflare?.accountId || '',
    apiToken: process.env.CLOUDFLARE_API_TOKEN || config?.cloudflare?.apiToken || '',
    zoneName: process.env.CLOUDFLARE_ZONE_NAME || config?.cloudflare?.zoneName || '',
    defaultOrigin: process.env.CLOUDFLARE_DEFAULT_ORIGIN || config?.cloudflare?.defaultOrigin || 'origin.app.internal',
  });

  return new DomainController(domainService, hostingService);
}