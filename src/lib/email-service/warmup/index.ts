/**
 * Email Warm-up & Deliverability Optimizer
 * Silk Mailer Integration
 *
 * Manages SMTP/IMAP inbox pools, pairs them for natural conversation threads,
 * uses LLM to generate realistic B2B email content, sends via Nodemailer,
 * and logs every outcome.
 */

export { WarmupWorker } from './worker';
export type { WorkerConfig } from './types';
export { DEFAULT_WORKER_CONFIG } from './types';
export type { InboxPair, PairingResult, GeneratedMessage, LLMGeneratorConfig, ThreadMessage, SendResult } from './types';
export { pairInboxes, pickReplyTarget } from './pairing-engine';
export { generateMessage } from './llm-generator';
export { sendWarmupEmail, clearTransporterCache, clearAllTransporters } from './sender';