import type { WarmupInbox, WarmupThread, WarmupLog } from '@prisma/client';

export interface ThreadMessage {
  role: 'sent' | 'replied';
  content: string;
  messageId: string;
  timestamp: string;
}

export interface WarmupInboxWithRelations extends WarmupInbox {
  sentThreads?: WarmupThread[];
  receivedThreads?: WarmupThread[];
}

export interface WarmupThreadWithRelations extends WarmupThread {
  sender?: WarmupInbox;
  receiver?: WarmupInbox;
  logs?: WarmupLog[];
}

// ─── Pairing engine ───
export interface InboxPair {
  sender: WarmupInbox;
  receiver: WarmupInbox;
}

export interface PairingResult {
  pairs: InboxPair[];
  skipped: number;
}

// ─── LLM generator ───
export interface GeneratedMessage {
  subject: string;
  body: string;
}

export interface LLMGeneratorConfig {
  provider: 'google' | 'openai' | 'anthropic';
  apiKey: string;
  model?: string;
}

// ─── Sender ───
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  threadId: string;
  inboxId: string;
}

// ─── Worker ───
export interface WorkerConfig {
  cycleIntervalMs: number;
  maxMessagesPerInboxPerCycle: number;
  maxMessagesPerThread: number;
  staleThreadTimeoutMs: number;
  llm: LLMGeneratorConfig;
}

export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  cycleIntervalMs: 5 * 60 * 1000,
  maxMessagesPerInboxPerCycle: 2,
  maxMessagesPerThread: 6,
  staleThreadTimeoutMs: 72 * 60 * 60 * 1000,
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini',
  },
};