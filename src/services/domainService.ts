// Domain Service – Name.com implementation (REST API)
// -----------------------------------------------------
// Ensure a fetch implementation is available (Node <18 may lack global fetch).
let fetchFn: typeof fetch;
if (typeof fetch !== 'undefined') {
  fetchFn = fetch;
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  fetchFn = require('node-fetch');
}

// -----------------------------------------------------
// This file provides thin wrappers around the Name.com v4 API for:
//   • Checking domain availability
//   • Registering/purchasing a domain
//   • (Optional) Adding the domain to a Vercel project for DNS/SSL
//
// Environment variables expected in `.env`:
//   NAMECOM_USERNAME   – your Name.com account username
//   NAMECOM_API_TOKEN  – API token generated in the Name.com dashboard
//   VERCEL_PROJECT_ID  – (optional) Vercel project ID for DNS setup
//   VERCEL_TOKEN       – (optional) Vercel API token
//
// All requests use the official Name.com REST endpoints.
// Authentication is HTTP Basic Auth where the username is the Name.com
// username and the password is the API token. The token is treated as a
// secret, so we never log it.

/** Helper to build the Basic Auth header for Name.com */
function namecomAuthHeader(): string {
  const username = process.env.NAMECOM_USERNAME ?? '';
  const token = process.env.NAMECOM_API_TOKEN ?? '';
  if (!username || !token) {
    throw new Error('Name.com credentials (USERNAME/API_TOKEN) missing from environment');
  }
  const credentials = `${username}:${token}`;
  // btoa works in the Node environment used by Next.js API routes.
  const encoded = Buffer.from(credentials).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Checks domain availability via Name.com REST API.
 * Returns an object: { available: boolean, price?: string, domain: string }
 */
export async function checkDomainAvailability(domainName: string) {
  console.log('DomainService: checking availability for', domainName);

  const useMock = process.env.NAMECOM_MOCK === 'true';
  if (useMock) {
    // Simple deterministic mock – domains ending with .test are available
    const mockAvailable = domainName.endsWith('.test');
    return { available: mockAvailable, price: mockAvailable ? '0.00' : '', domain: domainName };
  }

  try {
    const baseUrl = process.env.NAMECOM_API_BASE ?? 'https://api.sandbox.name.com';
    const url = new URL(`${baseUrl}/v4/domains:available`);
    url.searchParams.set('domain', domainName);
    const resp = await fetchFn(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: namecomAuthHeader(),
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.warn(`Name.com availability check non‑OK (${resp.status}): ${err}`);
      // In development, fall back to a simple mock so the UI can show results
      if (process.env.NODE_ENV !== 'production') {
        const mockAvailable = domainName.endsWith('.test');
        return { available: mockAvailable, price: mockAvailable ? '0.00' : '', domain: domainName };
      }
      return { available: false, price: '', domain: domainName };
    }
    const data: any = await resp.json();
    const available = !!data.available;
    const price = data.purchasePrice ?? '';
    return { available, price, domain: domainName };
  } catch (e) {
    // Network or parsing error – treat as unavailable and log
    console.error('Name.com availability fetch error:', e);
    return { available: false, price: '', domain: domainName };
  }
}

/**
 * Registers (purchases) a domain via Name.com.
 * Minimal payload – for sandbox you can omit contact details.
 * Returns { success: true, domain: string } on success.
 */
export async function registerDomain(domainName: string) {
  const useMock = process.env.NAMECOM_MOCK === 'true';
  if (useMock) {
    // Simulate a successful purchase without hitting the API
    return { success: true, domain: domainName, mock: true };
  }

  const baseUrl = process.env.NAMECOM_API_BASE ?? 'https://api.sandbox.name.com';
  const url = `${baseUrl}/v4/domains`;
  const payload = {
    domainName,
    years: 1,
    // In a real environment you must provide contact IDs for registrant,
    // admin, tech, and billing. For sandbox/testing we can omit them.
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: namecomAuthHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Name.com registration failed (${resp.status}): ${err}`);
  }
  const data = await resp.json();
  // Successful response includes {domain: {...}}
  return { success: true, domain: domainName, details: data };
}

/**
 * (Optional) Adds the newly purchased domain to a Vercel project and triggers
 * SSL provisioning. This function is unchanged from the previous implementation.
 */
export async function configureVercelDNS(domainName: string) {
  const projectId = process.env.VERCEL_PROJECT_ID;
  const token = process.env.VERCEL_TOKEN;
  if (!projectId || !token) {
    throw new Error('Vercel configuration missing (PROJECT_ID or TOKEN)');
  }
  const url = `https://api.vercel.com/v9/projects/${projectId}/domains`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: domainName }),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Vercel DNS configure failed: ${resp.status} ${errBody}`);
  }
  return await resp.json();
}
