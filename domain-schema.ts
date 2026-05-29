/**
 * Database Schema - Drizzle ORM Configuration
 * Define all tables for domain registration and configuration
 */

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  decimal,
  json,
  varchar,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { DatabaseDomain, DatabaseDomainRegistration, RegistrantInfo } from './domain-system-types';

// ============================================================================
// DOMAINS TABLE
// ============================================================================
// Stores domain information and their registration/hosting status
export const domains = pgTable(
  'domains',
  {
    id: text('id').primaryKey(),
    domain: varchar('domain', { length: 255 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    status: varchar('status', {
      enum: ['available', 'checking', 'registered', 'provisioning', 'active', 'failed', 'expired'],
    }).notNull().default('checking'),
    registrationStatus: varchar('registration_status', {
      enum: ['pending', 'processing', 'completed', 'failed'],
    }).notNull().default('pending'),
    hostingStatus: varchar('hosting_status', {
      enum: ['pending', 'provisioning', 'active', 'failed'],
    }).notNull().default('pending'),
    registrarOrderId: text('registrar_order_id'),
    registrarTransactionId: text('registrar_transaction_id'),
    registrationDate: timestamp('registration_date'),
    expirationDate: timestamp('expiration_date'),
    autoRenewal: boolean('auto_renewal').default(false),
    privacyEnabled: boolean('privacy_enabled').default(false),
    nameservers: json('nameservers').$type<string[]>(),
    cfZoneId: text('cf_zone_id'),
    cfCustomNameserver: text('cf_custom_nameserver'),
    sslStatus: varchar('ssl_status', {
      enum: ['pending', 'active', 'error'],
    }),
    certificateIssuedAt: timestamp('certificate_issued_at'),
    certificateExpiresAt: timestamp('certificate_expires_at'),
    failureReason: text('failure_reason'),
    failureCode: varchar('failure_code', { length: 100 }),
    lastStatusCheckAt: timestamp('last_status_check_at'),
    registrationAttempts: integer('registration_attempts').default(0),
    hostingAttempts: integer('hosting_attempts').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    domainIdx: uniqueIndex('domains_domain_workspace_idx').on(table.domain, table.workspaceId),
    workspaceIdx: uniqueIndex('domains_workspace_id_idx').on(table.workspaceId),
    userIdx: uniqueIndex('domains_user_id_idx').on(table.userId),
    expirationIdx: uniqueIndex('domains_expiration_date_idx').on(table.expirationDate),
  }),
);

// ============================================================================
// DOMAIN REGISTRATIONS TABLE
// ============================================================================
// Tracks domain registration orders and payment information
export const domainRegistrations = pgTable(
  'domain_registrations',
  {
    id: text('id').primaryKey(),
    domainId: text('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    workspaceId: varchar('workspace_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }).notNull(),
    status: varchar('status', {
      enum: ['pending', 'in_progress', 'completed', 'failed'],
    }).notNull().default('pending'),
    registrarOrderId: text('registrar_order_id'),
    registrationYears: integer('registration_years').default(1).notNull(),
    autoRenewal: boolean('auto_renewal').default(false),
    privacyProtection: boolean('privacy_protection').default(false),
    registrantInfo: json('registrant_info').$type<RegistrantInfo>(),
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    paymentIdx: uniqueIndex('registrations_stripe_payment_intent_idx').on(
      table.stripePaymentIntentId,
    ),
    domainIdx: uniqueIndex('registrations_domain_id_idx').on(table.domainId),
    statusIdx: uniqueIndex('registrations_status_idx').on(table.status),
  }),
);

// ============================================================================
// DOMAIN JOBS TABLE
// ============================================================================
// Queue for async domain operations (registration, provisioning, DNS validation)
export const domainJobs = pgTable(
  'domain_jobs',
  {
    id: text('id').primaryKey(),
    registrationId: text('registration_id')
      .notNull()
      .references(() => domainRegistrations.id, { onDelete: 'cascade' }),
    type: varchar('type', {
      enum: ['register_domain', 'provision_hosting', 'verify_dns', 'activate_ssl'],
    }).notNull(),
    status: varchar('status', {
      enum: ['pending', 'processing', 'completed', 'failed'],
    }).notNull().default('pending'),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(5).notNull(),
    payload: json('payload').$type<Record<string, unknown>>().notNull(),
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    registrationIdx: uniqueIndex('jobs_registration_id_idx').on(table.registrationId),
    statusIdx: uniqueIndex('jobs_status_idx').on(table.status),
    retryIdx: uniqueIndex('jobs_next_retry_at_idx').on(table.nextRetryAt),
  }),
);

// ============================================================================
// DOMAIN AUDIT LOG TABLE
// ============================================================================
// Tracks all changes and operations for compliance and debugging
export const domainAuditLog = pgTable(
  'domain_audit_log',
  {
    id: text('id').primaryKey(),
    domainId: text('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    action: varchar('action', {
      enum: [
        'created',
        'status_changed',
        'registration_started',
        'registration_completed',
        'hosting_provisioned',
        'ssl_activated',
        'renewal_scheduled',
        'error_occurred',
        'manual_update',
      ],
    }).notNull(),
    previousStatus: varchar('previous_status', { length: 50 }),
    newStatus: varchar('new_status', { length: 50 }),
    details: json('details').$type<Record<string, unknown>>(),
    performedBy: varchar('performed_by', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    domainIdx: uniqueIndex('audit_domain_id_idx').on(table.domainId),
    actionIdx: uniqueIndex('audit_action_idx').on(table.action),
  }),
);

export type DomainsType = typeof domains.$inferSelect;
export type DomainsInsertType = typeof domains.$inferInsert;

export type DomainRegistrationsType = typeof domainRegistrations.$inferSelect;
export type DomainRegistrationsInsertType = typeof domainRegistrations.$inferInsert;

export type DomainJobsType = typeof domainJobs.$inferSelect;
export type DomainJobsInsertType = typeof domainJobs.$inferInsert;

export type DomainAuditLogType = typeof domainAuditLog.$inferSelect;
export type DomainAuditLogInsertType = typeof domainAuditLog.$inferInsert;
