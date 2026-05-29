export interface ScrapedLead {
  id: string;
  userId: string;
  companyName: string;
  industry: string | null;
  location: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  status: 'discovered' | 'enriched' | 'pushed' | 'failed';
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessSearchResult {
  name: string;
  address: string;
  website?: string;
  phone?: string;
  rating?: number;
  types?: string[];
  placeId?: string;
}

export interface EnrichmentResult {
  email: string | null;
  confidence: number;
  sources: number;
}

export interface SearchRequest {
  query: string;
  location: string;
  maxResults?: number;
}

export interface PushToMailerRequest {
  leadIds: string[];
  recipientListId?: string;
  recipientListName?: string;
}