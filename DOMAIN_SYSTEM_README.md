# Domain Registration & Configuration System

Complete, production-ready domain registration system with automated SSL/DNS configuration using Namecheap Reseller API and Cloudflare for Platforms.

## Overview

This system provides a clean, modular architecture for integrating domain registration and hosting into your application. Users can:

1. **Check availability** - Real-time domain availability with pricing
2. **Purchase domains** - One-click purchase after Stripe payment
3. **Auto-provisioning** - Automatic Cloudflare setup with SSL certificates
4. **Status tracking** - Polling API for real-time registration status

## Architecture

### Service Layer (Abstraction)

```
IDomainService (interface)
├── NamecheapDomainService (implementation)
└── [Extensible: GoDaddy, Entri, etc.]

IHostingService (interface)
├── CloudflareHostingService (implementation)
└── [Extensible: Vercel, AWS, etc.]
```

### Core Components

| Component | Purpose |
|-----------|---------|
| `DomainController` | Orchestrates domain operations and workflows |
| `DomainErrorHandler` | Centralized error handling with retry logic |
| `DomainSchema` | Drizzle ORM database models |
| `DomainApiClient` | Type-safe client for frontend |

### Data Flow

```
User Payment (Stripe)
    ↓
POST /api/domains/purchase
    ↓
DomainController.purchaseDomain()
    ├─ Create domain record (DB)
    ├─ Create registration record (DB)
    └─ Queue registration job
    ↓
Background Worker
    ├─ register_domain job
    │  └─ NamecheapDomainService.registerDomain()
    ├─ provision_hosting job
    │  └─ CloudflareHostingService.provisionDomain()
    ├─ verify_dns job
    │  └─ Wait for DNS propagation
    └─ activate_ssl job
         └─ Verify SSL certificate active
    ↓
GET /api/domains/{registrationId}/status
    ↓
Response with status: 'active'
```

## Installation

### 1. Environment Variables

```bash
# .env.local
NAMECHEAP_API_KEY=your_api_key
NAMECHEAP_API_USER=your_username
NAMECHEAP_CLIENT_IP=your_ip_address
NAMECHEAP_SANDBOX=false  # true for testing

CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ZONE_NAME=yourdomain.com
CLOUDFLARE_DEFAULT_ORIGIN=origin.app.internal
```

### 2. Install Dependencies

```bash
npm install axios drizzle-orm pg dotenv
npm install -D @types/node typescript
```

### 3. Database Setup

```bash
# Create PostgreSQL database
createdb domain_registry

# Run migrations
npx drizzle-kit push
```

### 4. Copy Files to Your Project

```
src/lib/domains/
├── domain-system-types.ts      # Type definitions
├── domain-schema.ts            # Database schema
├── domain-service-interfaces.ts # Service contracts
├── domain-errors.ts            # Error handling
├── namecheap-service.ts        # Domain registration
├── cloudflare-service.ts       # Hosting provisioning
├── domain-controller.ts        # Business logic
└── domain-api-client.ts        # Frontend client

app/api/domains/
├── check/
│  └── route.ts                 # GET /api/domains/check
├── purchase/
│  └── route.ts                 # POST /api/domains/purchase
└── [registrationId]/
   └── status/
      └── route.ts              # GET /api/domains/{id}/status
```

## API Endpoints

### Check Domain Availability

```bash
GET /api/domains/check?domains=example.com,test.io&includePrice=true&includeSuggestions=true
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "status": "success",
    "results": [
      {
        "domain": "example.com",
        "available": false,
        "price": 8.99,
        "currency": "USD",
        "estimatedPriceUSD": 8.99
      },
      {
        "domain": "test.io",
        "available": true,
        "price": 45.00,
        "currency": "USD",
        "estimatedPriceUSD": 45.00
      }
    ],
    "suggestions": [
      {
        "domain": "example-io.com",
        "available": true,
        "price": 12.99
      }
    ],
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "dom_abc123..."
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "dom_abc123..."
}
```

### Purchase Domain

```bash
POST /api/domains/purchase
X-User-Id: user_123
Content-Type: application/json

{
  "domain": "mycompany.com",
  "workspaceId": "ws_abc123",
  "stripePaymentIntentId": "pi_1234567890",
  "registrationYears": 1,
  "autoRenewal": true,
  "privacyProtection": true,
  "registrantInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@company.com",
    "phone": "+1.5555555555",
    "organization": "Acme Inc",
    "address": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "postalCode": "94105",
      "country": "US"
    }
  }
}
```

**Response:**

```json
{
  "status": "processing",
  "data": {
    "registrationId": "reg_abc123...",
    "domain": "mycompany.com",
    "status": "pending_registration",
    "workspaceId": "ws_abc123",
    "estimatedActivationTime": "15-30 minutes",
    "nextCheckTimestamp": "2024-01-15T10:35:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "dom_xyz789..."
}
```

### Get Registration Status

```bash
GET /api/domains/{registrationId}/status
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "registrationId": "reg_abc123...",
    "domain": "mycompany.com",
    "status": "active",
    "expirationDate": "2025-01-15T00:00:00.000Z",
    "workspaceId": "ws_abc123"
  },
  "timestamp": "2024-01-15T10:35:00.000Z",
  "requestId": "dom_xyz789..."
}
```

## Frontend Integration

### React Component Example

```typescript
import { useCallback, useState } from 'react';
import { DomainApiClient } from '@/lib/domains/domain-api-client';

const client = new DomainApiClient('/api/domains', userId);

export function DomainPurchaseFlow() {
  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'purchasing' | 'active' | 'error'>(
    'idle',
  );
  const [registrationId, setRegistrationId] = useState('');

  const handleCheckAvailability = useCallback(async () => {
    setStatus('checking');
    const result = await client.checkAvailability([domain], { includePrice: true });

    if (result.status === 'success') {
      const isAvailable = result.data.results[0]?.available;
      setStatus(isAvailable ? 'idle' : 'error');
    }
  }, [domain]);

  const handlePurchase = useCallback(
    async (paymentIntentId: string) => {
      setStatus('purchasing');

      try {
        const result = await client.purchaseDomain({
          domain,
          workspaceId: 'ws_123',
          stripePaymentIntentId: paymentIntentId,
          registrantInfo: {
            /* ... */
          },
        });

        if (result.status === 'processing') {
          setRegistrationId(result.data.registrationId);

          // Poll for activation
          const finalStatus = await client.pollStatus(result.data.registrationId);
          setStatus(finalStatus.data.status === 'active' ? 'active' : 'error');
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('Purchase failed:', error);
        setStatus('error');
      }
    },
    [domain],
  );

  return (
    <div className="domain-purchase">
      {status === 'idle' && (
        <>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} />
          <button onClick={handleCheckAvailability}>Check Availability</button>
        </>
      )}

      {status === 'checking' && <p>Checking availability...</p>}

      {status === 'purchasing' && <p>Registering domain...</p>}

      {status === 'active' && <p>✓ Domain is now active!</p>}

      {status === 'error' && <p>✗ Something went wrong. Please try again.</p>}
    </div>
  );
}
```

## Error Handling

### Retryable Errors

The system automatically retries on these errors:

- Network timeouts
- Rate limiting (429)
- Temporary API failures (5xx)
- DNS propagation delays

Configuration:

```typescript
const retryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2, // Exponential backoff
};
```

### Error Response Format

```json
{
  "status": "error",
  "error": {
    "code": "PROVISIONING_FAILED",
    "message": "Failed to provision domain with SSL certificate",
    "retryable": true,
    "details": {
      "operation": "verify_dns",
      "attempts": 3,
      "lastError": "DNS record not yet propagated"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "dom_abc123..."
}
```

## Extending with New Providers

### Add New Domain Registrar

```typescript
// src/lib/domains/godaddy-service.ts
import { IDomainService } from './domain-service-interfaces';

export class GoDaddyDomainService implements IDomainService {
  async checkAvailability(request: DomainCheckRequest): Promise<DomainCheckResponse> {
    // GoDaddy API implementation
  }

  async registerDomain(payload: DomainRegistrationPayload): Promise<DomainRegistrationResult> {
    // GoDaddy registration
  }

  // ... implement other methods
}
```

### Add New Hosting Provider

```typescript
// src/lib/domains/vercel-service.ts
import { IHostingService } from './domain-service-interfaces';

export class VercelHostingService implements IHostingService {
  async provisionDomain(request: HostingProvisioningRequest): Promise<HostingProvisioningResult> {
    // Vercel API implementation
  }

  // ... implement other methods
}
```

Then use the new service:

```typescript
const domainService = new GoDaddyDomainService(config);
const hostingService = new VercelHostingService(config);
const controller = new DomainController(domainService, hostingService);
```

## Background Job Processing

Set up a background worker to process registration jobs:

```typescript
// lib/workers/domain-job-processor.ts
export async function processDomainJobs() {
  const controller = new DomainController(domainService, hostingService);

  // Find pending jobs
  const jobs = await db.query.domainJobs.findMany({
    where: eq(domainJobs.status, 'pending'),
  });

  for (const job of jobs) {
    try {
      if (job.type === 'register_domain') {
        await controller.processRegistrationJob(job.id);
      } else if (job.type === 'provision_hosting') {
        await controller.processProvisioningJob(job.id);
      }
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
    }
  }
}

// Run every 30 seconds
setInterval(processDomainJobs, 30000);
```

## Security Considerations

1. **API Key Management**
   - Store all API keys in environment variables
   - Never commit `.env.local`
   - Rotate keys regularly

2. **Payment Integration**
   - Verify Stripe payment intent before processing
   - Validate user ownership of workspace
   - Log all domain purchases for compliance

3. **Rate Limiting**
   - Implement rate limiting on check endpoint
   - Use Stripe Billing for preventing abuse
   - Monitor for suspicious registration patterns

4. **Data Protection**
   - Encrypt sensitive registrant info in database
   - Audit all domain operations
   - Comply with GDPR/WHOIS privacy regulations

## Monitoring & Logging

All operations are logged with structured data:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "operation": "registerDomain",
  "domain": "mycompany.com",
  "workspaceId": "ws_abc123",
  "userId": "user_123",
  "requestId": "dom_xyz789",
  "duration": 2500,
  "status": "success"
}
```

## Testing

### Unit Tests

```bash
npm test -- domain-controller.test.ts
npm test -- namecheap-service.test.ts
npm test -- cloudflare-service.test.ts
```

### Integration Tests

```bash
npm test:integration -- domain-purchase-flow.test.ts
```

### Load Testing

```bash
# Test with k6
k6 run domain-load-test.js
```

## Performance Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| Check availability | 2-3s | Cached, parallel queries |
| Register domain | 30-60s | Namecheap API processing |
| Provision hosting | 15-30s | Cloudflare zone setup |
| SSL issuance | 5-15 min | Certificate validation |
| Total activation | 20-50 min | All steps combined |

## Troubleshooting

### Domain Registration Fails

1. Verify Namecheap API credentials
2. Check if domain is already registered
3. Ensure client IP is whitelisted in Namecheap
4. Check registrant information format

### SSL Certificate Pending

1. Verify DNS validation records are added
2. Wait for DNS propagation (up to 24 hours)
3. Check Cloudflare Zone ID is correct
4. Inspect Cloudflare dashboard for errors

### Stripe Payment Integration

1. Verify payment intent status before registration
2. Implement idempotency keys for retries
3. Handle webhook properly for payment confirmations
4. Test with Stripe's test mode first

## License

MIT

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review error logs with request ID
3. Contact Namecheap or Cloudflare support for provider-specific issues
