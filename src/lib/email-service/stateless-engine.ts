/**
 * Stateless Sending Engine
 * High-performance bulk email processing without persistent storage
 * Designed for B2B email campaigns with real-time progress tracking
 */

import { EmailSendResult } from './types';
import { filterBusinessOnly, buildLeadPlaceholders, renderHtmlTemplate, renderTextTemplate, BusinessLead } from './business-filter';

export interface CampaignConfig {
  subject: string;
  htmlContent: string;
  textContent?: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
}

export interface SendResult {
  sent: number;
  failed: number;
  filtered: number;
  messageIds: string[];
  errors: Array<{ index: number; error: string }>;
  duration: number;
}

export interface ProgressCallback {
  (progress: {
    sent: number;
    failed: number;
    total: number;
    percentage: number;
    currentBatch: number;
    totalBatches: number;
  }): void;
}

export interface SendOptions {
  /** Email service sender function */
  sendFn: (to: string, html: string, subject: string, from: string, headers?: Record<string, string>) => Promise<EmailSendResult>;
  /** Campaign configuration */
  config: CampaignConfig;
  /** Leads to send to (processed in-memory only) */
  leads: BusinessLead[];
  /** Batch size (default: 10) */
  batchSize?: number;
  /** Delay between batches in ms (default: 2000) */
  batchDelay?: number;
  /** Progress callback for real-time updates */
  onProgress?: ProgressCallback;
  /** Abort controller for cancellation */
  abortController?: AbortController;
}

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_BATCH_DELAY = 2000;

/**
 * Execute a stateless bulk send campaign
 * All processing happens in-memory, no recipient data persists
 */
export async function executeStatelessCampaign(options: SendOptions): Promise<SendResult> {
  const {
    sendFn,
    config,
    leads,
    batchSize = DEFAULT_BATCH_SIZE,
    batchDelay = DEFAULT_BATCH_DELAY,
    onProgress,
    abortController,
  } = options;

  const startTime = Date.now();
  const messageIds: string[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  let sent = 0;
  let failed = 0;
  let filtered = 0;

  // Step 1: Filter to business-only leads (in-memory, no logging)
  const filterResult = filterBusinessOnly(leads);
  filtered = filterResult.stats.filteredCount;
  const businessLeads = filterResult.business;

  // Step 2: Calculate batches
  const totalBatches = Math.ceil(businessLeads.length / batchSize);
  const batches = chunkArray(businessLeads, batchSize);

  // Step 3: Process each batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    // Check for abort
    if (abortController?.signal.aborted) {
      break;
    }

    const batch = batches[batchIndex];

    // Process batch items sequentially for rate limiting
    for (let i = 0; i < batch.length; i++) {
      if (abortController?.signal.aborted) break;

      const lead = batch[i];
      const globalIndex = batchIndex * batchSize + i;

      try {
        // Build placeholders and render template in-memory
        const placeholders = buildLeadPlaceholders(lead);
        const renderedHtml = renderHtmlTemplate(config.htmlContent, placeholders);
        const renderedText = config.textContent
          ? renderTextTemplate(config.textContent, placeholders)
          : undefined;

        // Build headers
        const headers = buildDeliverabilityHeaders(config.fromEmail, lead.email);

        // Send email
        const result = await sendFn(lead.email, renderedHtml, config.subject, config.fromEmail, headers);

        if (result.success) {
          sent++;
          if (result.messageId) {
            messageIds.push(result.messageId);
          }
        } else {
          failed++;
          errors.push({ index: globalIndex, error: result.error || 'Unknown error' });
        }
      } catch (error) {
        failed++;
        errors.push({
          index: globalIndex,
          error: error instanceof Error ? error.message : 'Send failed',
        });
      }
    }

    // Report batch progress
    if (onProgress) {
      onProgress({
        sent,
        failed,
        total: businessLeads.length,
        percentage: Math.round(((sent + failed) / businessLeads.length) * 100),
        currentBatch: batchIndex + 1,
        totalBatches,
      });
    }

    // Delay between batches (except last)
    if (batchIndex < batches.length - 1 && !abortController?.signal.aborted) {
      await sleep(batchDelay);
    }
  }

  return {
    sent,
    failed,
    filtered,
    messageIds,
    errors,
    duration: Date.now() - startTime,
  };
}

/**
 * Build deliverability-focused headers for B2B email
 */
function buildDeliverabilityHeaders(
  fromEmail: string,
  toEmail: string
): Record<string, string> {
  const domain = fromEmail.split('@')[1] || 'unknown';

  return {
    // List-Unsubscribe for CAN-SPAM compliance
    'List-Unsubscribe': `<mailto:unsubscribe@${domain}?subject=Unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',

    // Priority headers (avoid '1' high priority as it's spam-like)
    'X-Priority': '3',
    'X-MSMail-Priority': 'Normal',

    // Prevent auto-responses
    'X-Auto-Response-Suppress': 'All',
    'Auto-Submitted': 'auto-generated',

    // Feedback loop for bounce handling
    'Feedback-ID': `campaign:${Date.now()}:${domain}`,

    // Clean Message-ID format for threading
    'Message-ID': generateMessageId(domain),

    // X-Entity-Ref-ID to prevent duplicate detection issues
    'X-Entity-Ref-ID': `<${Date.now()}-${randomId()}@${domain}>`,
  };
}

/**
 * Generate a clean Message-ID following RFC 5322
 */
function generateMessageId(domain: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomId();
  return `<${timestamp}.${random}@${domain}>`;
}

/**
 * Generate a random ID for message tracking
 */
function randomId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a batch processor for streaming results to UI
 * Returns an async generator that yields progress updates
 */
export async function* createStreamingCampaign(
  options: SendOptions
): AsyncGenerator<{
  type: 'progress' | 'complete' | 'error';
  data: any;
}> {
  const {
    sendFn,
    config,
    leads,
    batchSize = DEFAULT_BATCH_SIZE,
    batchDelay = DEFAULT_BATCH_DELAY,
    abortController,
  } = options;

  const filterResult = filterBusinessOnly(leads);
  const businessLeads = filterResult.business;

  const totalBatches = Math.ceil(businessLeads.length / batchSize);
  const batches = chunkArray(businessLeads, batchSize);

  let sent = 0;
  let failed = 0;

  try {
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      if (abortController?.signal.aborted) {
        yield { type: 'complete', data: { aborted: true, sent, failed } };
        return;
      }

      const batch = batches[batchIndex];
      const batchResults = [];

      for (let i = 0; i < batch.length; i++) {
        if (abortController?.signal.aborted) break;

        const lead = batch[i];
        const placeholders = buildLeadPlaceholders(lead);
        const renderedHtml = renderHtmlTemplate(config.htmlContent, placeholders);
        const renderedText = config.textContent
          ? renderTextTemplate(config.textContent, placeholders)
          : undefined;

        const headers = buildDeliverabilityHeaders(config.fromEmail, lead.email);
        const result = await sendFn(lead.email, renderedHtml, config.subject, config.fromEmail, headers);

        if (result.success) sent++;
        else failed++;

        batchResults.push({ email: 'REDACTED', success: result.success, messageId: result.messageId });
      }

      // Yield batch progress
      yield {
        type: 'progress',
        data: {
          batch: batchIndex + 1,
          totalBatches,
          sent,
          failed,
          total: businessLeads.length,
          percentage: Math.round(((sent + failed) / businessLeads.length) * 100),
        },
      };

      if (batchIndex < batches.length - 1 && !abortController?.signal.aborted) {
        await sleep(batchDelay);
      }
    }

    yield {
      type: 'complete',
      data: { sent, failed, filtered: filterResult.stats.filteredCount },
    };
  } catch (error) {
    yield {
      type: 'error',
      data: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * Quick validation check for campaign before sending
 */
export function validateCampaignConfig(config: CampaignConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.subject?.trim()) {
    errors.push('Subject is required');
  }

  if (!config.htmlContent?.trim()) {
    errors.push('HTML content is required');
  }

  if (!config.fromEmail?.trim()) {
    errors.push('From email is required');
  }

  if (config.fromEmail && !isValidEmail(config.fromEmail)) {
    errors.push('Invalid from email format');
  }

  if (config.replyTo && !isValidEmail(config.replyTo)) {
    errors.push('Invalid reply-to email format');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}