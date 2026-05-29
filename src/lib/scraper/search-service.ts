/**
 * Search Service — fetches local business listings from Google Places API.
 *
 * Expects env var: GOOGLE_PLACES_API_KEY
 * Falls back to a Serper.dev integration if SERPER_API_KEY is set instead.
 */

export interface BusinessResult {
  name: string;
  address: string;
  website: string | null;
  phone: string | null;
  rating: number | null;
  types: string[];
  placeId: string;
}

interface GooglePlacesResponse {
  results?: Array<{
    name: string;
    formatted_address: string;
    website?: string;
    international_phone_number?: string;
    rating?: number;
    types?: string[];
    place_id: string;
  }>;
  status: string;
  error_message?: string;
  next_page_token?: string;
}

interface SerperResponse {
  organic?: Array<{
    title: string;
    link: string;
    snippet?: string;
    position?: number;
  }>;
  places?: Array<{
    title: string;
    address?: string;
    phone?: string;
    website?: string;
    rating?: number;
    ratingCount?: number;
  }>;
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Search via Google Places API (Text Search).
 */
async function searchGooglePlaces(
  query: string,
  location: string,
  apiKey: string,
  maxResults: number,
): Promise<BusinessResult[]> {
  const textQuery = `${query} in ${location}`;
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', textQuery);
  url.searchParams.set('key', apiKey);

  const results: BusinessResult[] = [];

  // We may paginate up to 3 pages (60 results) to hit maxResults
  let page = 0;

  while (page < 3 && results.length < maxResults) {
    const res = await fetch(url.toString());
    const data: GooglePlacesResponse = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${data.status} — ${data.error_message ?? ''}`);
    }

    if (data.results) {
      for (const place of data.results) {
        if (results.length >= maxResults) break;
        results.push({
          name: place.name,
          address: place.formatted_address,
          website: place.website ?? null,
          phone: place.international_phone_number ?? null,
          rating: place.rating ?? null,
          types: place.types ?? [],
          placeId: place.place_id,
        });
      }
    }

    if (data.next_page_token && results.length < maxResults) {
      // Google requires a short delay before using the next page token
      await new Promise((r) => setTimeout(r, 2000));
      url.searchParams.set('pagetoken', data.next_page_token);
      page++;
    } else {
      break;
    }
  }

  return results;
}

/**
 * Search via Serper.dev (Google Search API alternative).
 */
async function searchSerper(
  query: string,
  location: string,
  apiKey: string,
  maxResults: number,
): Promise<BusinessResult[]> {
  const textQuery = `${query} in ${location}`;

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: textQuery,
      num: Math.min(maxResults, 20),
    }),
  });

  if (!res.ok) {
    throw new Error(`Serper.dev API error: ${res.status} ${res.statusText}`);
  }

  const data: SerperResponse = await res.json();
  const results: BusinessResult[] = [];

  // Serper returns "places" for local results
  if (data.places) {
    for (const place of data.places) {
      if (results.length >= maxResults) break;
      results.push({
        name: place.title,
        address: place.address ?? '',
        website: place.website ?? null,
        phone: place.phone ?? null,
        rating: place.rating ?? null,
        types: [],
        placeId: '',
      });
    }
  }

  // Fallback: extract from organic results if no places returned
  if (results.length === 0 && data.organic) {
    for (const item of data.organic) {
      if (results.length >= maxResults) break;
      const domain = item.link ? extractDomain(item.link) : null;
      results.push({
        name: item.title,
        address: item.snippet ?? '',
        website: domain ? `https://${domain}` : null,
        phone: null,
        rating: null,
        types: [],
        placeId: '',
      });
    }
  }

  return results;
}

/**
 * High-level search: tries Google Places first, falls back to Serper.
 */
export async function searchBusinesses(
  query: string,
  location: string,
  maxResults: number = 20,
): Promise<{ results: BusinessResult[]; source: string }> {
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
  const serperApiKey = process.env.SERPER_API_KEY;

  if (googleApiKey) {
    const results = await searchGooglePlaces(query, location, googleApiKey, maxResults);
    return { results, source: 'google_places' };
  }

  if (serperApiKey) {
    const results = await searchSerper(query, location, serperApiKey, maxResults);
    return { results, source: 'serper' };
  }

  throw new Error(
    'No search API key configured. Set GOOGLE_PLACES_API_KEY or SERPER_API_KEY in your environment.',
  );
}