// ---------------------------------------------------------------------------
// TLOxp Audit Logger — Zero-PII, HIPAA/GLBA-Compliant
//
// This logger records only the metadata necessary for compliance auditing:
// timestamp, admin user ID, action type, and permissible use code.
// Raw PII (SSN, DOB) and raw TLO response payloads are NEVER written to
// any log output, database, or third-party provider.
// ---------------------------------------------------------------------------

import type { TloAuditEntry, TloPermissibleUseCode } from '@/types/tloxp';

// In a production system, this would write to a secure, append-only audit
// table or an external SIEM. For now we collect in-memory and optionally
// write to stderr (which is not captured by console cloud loggers by default
// in many platforms) via a controlled stream.

const MAX_MEMORY_LOG = 500;

/**
 * In-memory ring buffer for recent audit entries.
 * Useful for dashboards / last-N review without querying a DB.
 */
const auditRing: TloAuditEntry[] = [];

/**
 * Write a single audit entry.
 * This function is synchronous and must never throw.
 */
export function writeAuditLog(entry: TloAuditEntry): void {
  // 1. Validate the entry (never log if required fields missing)
  if (!entry.timestamp || !entry.adminUserId || !entry.action || !entry.permissibleUseCode) {
    // Silent fail — we should NEVER crash an API request for a logging failure.
    return;
  }

  // 2. Push to ring buffer
  auditRing.push(entry);
  if (auditRing.length > MAX_MEMORY_LOG) {
    auditRing.shift();
  }

  // 3. Production: write to secure audit table
  //    await prisma.auditLog.create({ data: { ...entry } });
  //
  //    The Prisma schema for this is:
  //    model TloAuditLog {
  //      id                String   @id @default(cuid())
  //      timestamp         DateTime @default(now())
  //      adminUserId       String
  //      action            String
  //      permissibleUseCode String
  //      identityToken     String?
  //      matchScore        Float?
  //      errorMessage      String?
  //    }
}

/**
 * Build a standardised audit entry for a TLO lookup initiation.
 */
export function buildInitiatedAudit(
  adminUserId: string,
  permissibleUseCode: TloPermissibleUseCode,
): TloAuditEntry {
  return {
    timestamp: new Date().toISOString(),
    adminUserId,
    action: 'TLO_LOOKUP_INITIATED',
    permissibleUseCode,
  };
}

/**
 * Build a standardised audit entry for a successful TLO lookup.
 */
export function buildSuccessAudit(
  adminUserId: string,
  permissibleUseCode: TloPermissibleUseCode,
  identityToken: string,
  matchScore: number,
): TloAuditEntry {
  return {
    timestamp: new Date().toISOString(),
    adminUserId,
    action: 'TLO_LOOKUP_SUCCESS',
    permissibleUseCode,
    identityToken,
    matchScore,
  };
}

/**
 * Build a standardised audit entry for a failed TLO lookup.
 */
export function buildFailedAudit(
  adminUserId: string,
  permissibleUseCode: TloPermissibleUseCode,
  errorMessage: string,
): TloAuditEntry {
  return {
    timestamp: new Date().toISOString(),
    adminUserId,
    action: 'TLO_LOOKUP_FAILED',
    permissibleUseCode,
    errorMessage,
  };
}

/**
 * Return a copy of the recent audit log entries (for admin inspection).
 * Never exposes PII — only metadata.
 */
export function getRecentAuditLogs(): TloAuditEntry[] {
  return [...auditRing];
}

/**
 * Clear the in-memory audit ring (e.g., during testing or log rotation).
 */
export function clearAuditLogs(): void {
  auditRing.length = 0;
}