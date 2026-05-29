/**
 * Enrichment Service — uses Hunter.io API to find email addresses for a given domain.
 *
 * Expects env var: HUNTER_API_KEY
 * Falls back to Apollo.io integration if APOLLO_API_KEY is set instead.
 */

export interface EnrichmentResult {
  email: string | null;
  confidence: number;
  firstName: string | null;
  lastName: string | null;
  sources: number;
}

interface HunterDomainResponse {
  data?: {
    domain: string;
    webmail: boolean;
    pattern?: string;
    organization?: string;
    emails?: Array<{
      value: string;
      type: string;
      confidence: number;
      sources: Array<{ domain: string; uri: string; extracted_on?: string }>;
      first_name?: string;
      last_name?: string;
      position?: string;
    }>;
  };
  errors?: Array<{ id: string; code: string; details: string }>;
}

interface ApolloResponse {
  data?: {
    organization?: {
      name: string;
      domain: string;
    };
    people?: Array<{
      id: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      seniority?: string;
      departments?: string[];
    }>;
  };
}

function extractDomain(website: string): string {
  try {
    const u = new URL(website.startsWith('http') ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return website;
  }
}

/**
 * Enrich via Hunter.io's Email Finder API.
 */
async function enrichViaHunter(domain: string, apiKey: string): Promise<EnrichmentResult> {
  const url = new URL('https://api.hunter.io/v2/domain-search');
  url.searchParams.set('domain', domain);
  url.searchParams.set('api_key', apiKey);

  const res = await fetch(url.toString());
  const data: HunterDomainResponse = await res.json();

  if (data.errors && data.errors.length > 0) {
    console.warn(`[Hunter.io] API error for ${domain}:`, data.errors);
    return { email: null, confidence: 0, firstName: null, lastName: null, sources: 0 };
  }

  const emails = data.data?.emails;
  if (!emails || emails.length === 0) {
    return { email: null, confidence: 0, firstName: null, lastName: null, sources: 0 };
  }

  // Pick the email with the highest confidence that is a "generic" or "personal" type
  let best: (typeof emails)[0] | null = null;
  for (const e of emails) {
    if (e.type === 'personal' || e.type === 'generic') {
      if (!best || e.confidence > best.confidence) {
        best = e;
      }
    }
  }

  if (!best) {
    // Fallback to any email if we didn't find personal/generic
    best = emails[0];
  }

  return {
    email: best.value,
    confidence: best.confidence,
    firstName: best.first_name ?? null,
    lastName: best.last_name ?? null,
    sources: best.sources?.length ?? 0,
  };
}

/**
 * Enrich via Apollo.io API — queries people linked to an organization domain.
 */
async function enrichViaApollo(domain: string, apiKey: string): Promise<EnrichmentResult> {
  const res = await fetch('https://api.apollo.io/v1/people/search', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q_organization_domains: [domain],
      person_titles: ['owner', 'founder', 'ceo', 'manager', 'director', 'president'],
      per_page: 5,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`[Apollo.io] API error for ${domain}: ${res.status} — ${text}`);
    return { email: null, confidence: 0, firstName: null, lastName: null, sources: 0 };
  }

  const data: ApolloResponse = await res.json();
  const people = data.data?.people;

  if (!people || people.length === 0) {
    return { email: null, confidence: 0, firstName: null, lastName: null, sources: 0 };
  }

  // Return the first person with an email
  const firstWithEmail = people.find((p) => p.email);
  if (!firstWithEmail) {
    return { email: null, confidence: 0, firstName: null, lastName: null, sources: 0 };
  }

  return {
    email: firstWithEmail.email ?? null,
    confidence: 75, // Apollo doesn't provide a confidence score; we default to 75
    firstName: firstWithEmail.first_name ?? null,
    lastName: firstWithEmail.last_name ?? null,
    sources: 1,
  };
}

/**
 * High-level enrichment: takes a website URL and returns the best email found.
 * Tries Hunter.io first, then falls back to Apollo.io.
 */
export async function enrichBusinessEmail(
  website: string | null,
): Promise<EnrichmentResult> {
  if (!website) {
    return { email: null, confidence: 0, firstName: null, lastName: null, sources: 0 };
  }

  const domain = extractDomain(website);
  if (!domain) {
    return { email: null, confidence: 0, firstName: null, lastName: null, sources: 0 };
  }

  const hunterApiKey = process.env.HUNTER_API_KEY;
  const apolloApiKey = process.env.APOLLO_API_KEY;

  // Try Hunter.io first
  if (hunterApiKey) {
    try {
      const result = await enrichViaHunter(domain, hunterApiKey);
      if (result.email) return result;
    } catch (err) {
      console.warn(`[Hunter.io] Exception for ${domain}:`, err);
    }
  }

  // Fallback to Apollo.io
  if (apolloApiKey) {
    try {
      const result = await enrichViaApollo(domain, apolloApiKey);
      return result;
    } catch (err) {
      console.warn(`[Apollo.io] Exception for ${domain}:`, err);
    }
  }

  return { email: null, confidence: 0, firstName: null, lastName: null, sources: 0 };
}