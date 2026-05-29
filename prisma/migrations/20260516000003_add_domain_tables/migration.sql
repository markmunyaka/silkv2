-- Domain System Tables
-- Models for domain registration, hosting, and management

-- Domains table
CREATE TABLE IF NOT EXISTS "domains" (
  "id" TEXT PRIMARY KEY,
  "domain" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'checking' CHECK("status" IN ('available', 'checking', 'registered', 'provisioning', 'active', 'failed', 'expired')),
  "registration_status" TEXT NOT NULL DEFAULT 'pending' CHECK("registration_status" IN ('pending', 'processing', 'completed', 'failed')),
  "hosting_status" TEXT NOT NULL DEFAULT 'pending' CHECK("hosting_status" IN ('pending', 'provisioning', 'active', 'failed')),
  "registrar_order_id" TEXT,
  "registrar_transaction_id" TEXT,
  "registration_date" DATETIME,
  "expiration_date" DATETIME,
  "auto_renewal" INTEGER NOT NULL DEFAULT 0,
  "privacy_enabled" INTEGER NOT NULL DEFAULT 0,
  "nameservers" TEXT,
  "cf_zone_id" TEXT,
  "cf_custom_nameserver" TEXT,
  "ssl_status" TEXT CHECK("ssl_status" IN ('pending', 'active', 'error')),
  "certificate_issued_at" DATETIME,
  "certificate_expires_at" DATETIME,
  "failure_reason" TEXT,
  "failure_code" TEXT,
  "last_status_check_at" DATETIME,
  "registration_attempts" INTEGER NOT NULL DEFAULT 0,
  "hosting_attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Domain registrations table
CREATE TABLE IF NOT EXISTS "domain_registrations" (
  "id" TEXT PRIMARY KEY,
  "domain_id" TEXT NOT NULL REFERENCES "domains"("id") ON DELETE CASCADE,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "stripe_payment_intent_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK("status" IN ('pending', 'in_progress', 'completed', 'failed')),
  "registrar_order_id" TEXT,
  "registration_years" INTEGER NOT NULL DEFAULT 1,
  "auto_renewal" INTEGER NOT NULL DEFAULT 0,
  "privacy_protection" INTEGER NOT NULL DEFAULT 0,
  "registrant_info" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" DATETIME,
  "next_retry_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Domain jobs table
CREATE TABLE IF NOT EXISTS "domain_jobs" (
  "id" TEXT PRIMARY KEY,
  "registration_id" TEXT NOT NULL REFERENCES "domain_registrations"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL CHECK("type" IN ('register_domain', 'provision_hosting', 'verify_dns', 'activate_ssl')),
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK("status" IN ('pending', 'processing', 'completed', 'failed')),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "payload" TEXT NOT NULL DEFAULT '{}',
  "error_code" TEXT,
  "error_message" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "next_retry_at" DATETIME,
  "completed_at" DATETIME
);

-- Domain audit log table
CREATE TABLE IF NOT EXISTS "domain_audit_log" (
  "id" TEXT PRIMARY KEY,
  "domain_id" TEXT NOT NULL REFERENCES "domains"("id") ON DELETE CASCADE,
  "action" TEXT NOT NULL CHECK("action" IN ('created', 'status_changed', 'registration_started', 'registration_completed', 'hosting_provisioned', 'ssl_activated', 'renewal_scheduled', 'error_occurred', 'manual_update')),
  "previous_status" TEXT,
  "new_status" TEXT,
  "details" TEXT,
  "performed_by" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS "domains_domain_workspace_idx" ON "domains"("domain", "workspace_id");
CREATE INDEX IF NOT EXISTS "domains_workspace_id_idx" ON "domains"("workspace_id");
CREATE INDEX IF NOT EXISTS "domains_user_id_idx" ON "domains"("user_id");
CREATE INDEX IF NOT EXISTS "domains_expiration_date_idx" ON "domains"("expiration_date");

CREATE INDEX IF NOT EXISTS "registrations_stripe_payment_intent_idx" ON "domain_registrations"("stripe_payment_intent_id");
CREATE INDEX IF NOT EXISTS "registrations_domain_id_idx" ON "domain_registrations"("domain_id");
CREATE INDEX IF NOT EXISTS "registrations_status_idx" ON "domain_registrations"("status");

CREATE INDEX IF NOT EXISTS "jobs_registration_id_idx" ON "domain_jobs"("registration_id");
CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "domain_jobs"("status");
CREATE INDEX IF NOT EXISTS "jobs_next_retry_at_idx" ON "domain_jobs"("next_retry_at");

CREATE INDEX IF NOT EXISTS "audit_domain_id_idx" ON "domain_audit_log"("domain_id");
CREATE INDEX IF NOT EXISTS "audit_action_idx" ON "domain_audit_log"("action");