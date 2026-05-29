// ---------------------------------------------------------------------------
// TLOxp (TransUnion TruLookup) — Type Definitions
//
// These interfaces define the request/response payloads for the TLO
// identity verification service. The raw PII (SSN, DOB) is NEVER persisted
// to any database or log; it exists only in memory for the lifecycle of
// a single API request.
// ---------------------------------------------------------------------------

// ─── Permissible Use Codes ────────────────────────────────────────────────
// GLBA = Gramm-Leach-Bliley Act
// FCRA = Fair Credit Reporting Act
// DPPA = Driver's Privacy Protection Act

export type TloPermissibleUseCode =
  | 'GLBA_FRAUD_PREVENTION'
  | 'GLBA_SERVICE_PROVIDER'
  | 'FCRA_BUSINESS_TRANSACTION'
  | 'FCRA_LEGITIMATE_BUSINESS_NEED'
  | 'DPPA_PERMISSIBLE_USE'
  | 'CONSENT_BASED'
  | 'LAW_ENFORCEMENT'
  | 'COURT_ORDER';

// ─── TLOxp Request (backend → TLO API) ────────────────────────────────────

export interface TloLookupRequest {
  /** Subject's first name */
  FirstName: string;
  /** Subject's last name */
  LastName: string;
  /** Social Security Number (9 digits, no dashes) */
  SSN: string;
  /** Date of Birth in YYYY-MM-DD format */
  DOB: string;
  /** Current or last-known street address (optional but improves match rate) */
  CurrentAddress?: string;
  /** City (optional) */
  City?: string;
  /** 2-letter state code (optional) */
  State?: string;
  /** ZIP code (optional) */
  Zip?: string;
}

export type TloLookupMode = 'identity' | 'phone' | 'background';

// ─── TLOxp Internal Request (from frontend / controller) ───────────────────
// The PermissibleUseCode is selected externally (by the operator) and
// injected here. It is NEVER selected by the TLO service itself.

export interface TloVerifyRequest {
  firstName?: string;
  lastName?: string;
  ssn?: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  permissibleUseCode: TloPermissibleUseCode;
}

// ─── Anomaly / Flag ────────────────────────────────────────────────────────

export interface TloAnomaly {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ─── TLOxp Response (TLO API → backend → frontend) ────────────────────────

export interface TloLookupResponse {
  /** 0–100 match confidence score */
  matchScore: number;
  /** Unique identity token from TLO (can be logged in audit without PII) */
  identityToken: string;
  /** Whether the identity was verified to the required threshold */
  verified: boolean;
  /** Any anomalies or red flags detected */
  anomalies: TloAnomaly[];
  /** When present, the person is confirmed as deceased */
  deceasedIndicator: boolean;
  /** Age of the subject derived from DOB */
  age?: number;
  /** Optional scoring tier */
  tier?: 'A' | 'B' | 'C' | 'D' | 'E';
}

// ─── Controller/API Response (backend → frontend) ─────────────────────────

export interface TloVerifyResponse {
  ok: boolean;
  data?: TloLookupResponse;
  error?: string;
  /** The permissible use code that was used for this search */
  usedCode: TloPermissibleUseCode;
}

// ─── Audit Log Entry (Zero-PII) ───────────────────────────────────────────

export interface TloAuditEntry {
  timestamp: string;
  adminUserId: string;
  action: 'TLO_LOOKUP_INITIATED' | 'TLO_LOOKUP_SUCCESS' | 'TLO_LOOKUP_FAILED';
  permissibleUseCode: TloPermissibleUseCode;
  identityToken?: string;
  matchScore?: number;
  errorMessage?: string;
}

// ─── Permissible Use Descriptions (for UI dropdown) ────────────────────────

export interface PermissibleUseOption {
  code: TloPermissibleUseCode;
  label: string;
  description: string;
}

export const PERMISSIBLE_USE_OPTIONS: PermissibleUseOption[] = [
  {
    code: 'GLBA_FRAUD_PREVENTION',
    label: 'GLBA — Fraud Prevention',
    description: 'Fraud prevention and detection activities under the Gramm-Leach-Bliley Act',
  },
  {
    code: 'GLBA_SERVICE_PROVIDER',
    label: 'GLBA — Service Provider',
    description: 'Service provider performing functions on behalf of the financial institution',
  },
  {
    code: 'FCRA_BUSINESS_TRANSACTION',
    label: 'FCRA — Business Transaction',
    description: 'Legitimate business transaction initiated by the consumer',
  },
  {
    code: 'FCRA_LEGITIMATE_BUSINESS_NEED',
    label: 'FCRA — Legitimate Business Need',
    description: 'Legitimate business need in connection with a business transaction',
  },
  {
    code: 'CONSENT_BASED',
    label: 'Consent Based',
    description: 'Search conducted with the explicit written consent of the subject',
  },
  {
    code: 'LAW_ENFORCEMENT',
    label: 'Law Enforcement',
    description: 'Law enforcement agency conducting official duties (restricted)',
  },
  {
    code: 'COURT_ORDER',
    label: 'Court Order',
    description: 'Search pursuant to a valid court order or federal statute',
  },
];