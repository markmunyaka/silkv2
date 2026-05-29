export type RotationStrategy = 'round-robin' | 'weighted' | 'random' | 'failover';

export interface SmtpServer {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName?: string;
  maxEmailsPerDay: number;
  maxEmailsPerHour: number;
  delayBetweenEmailsMs: number;
  isActive: boolean;
  sentToday: number;
  sentThisHour: number;
  lastUsedAt?: string;
  localAddress?: string; // Outgoing IP address for binding
  weight: number; // for weighted rotation
  failures: number;
  isHealthy: boolean;
  createdAt: string;
}

export interface Recipient {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  position?: string;
  customFields?: Record<string, string>;
  status: 'pending' | 'valid' | 'invalid' | 'bounced' | 'sent' | 'failed';
  validatedAt?: string;
  error?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  smtpServerIds: string[]; // which SMTP servers to rotate through
  recipientListId: string;
  scheduleAt?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'cancelled';
  sendDelayMs: number;
  trackOpens: boolean;
  trackClicks: boolean;
  attachments: Attachment[];
  sentCount: number;
  failedCount: number;
  bouncedCount: number;
  openCount: number;
  clickCount: number;
  createdAt: string;
  sentAt?: string;
  completedAt?: string;
}

export interface Attachment {
  filename: string;
  content: string; // base64
  contentType: string;
  size: number;
}

export interface SendLog {
  id: string;
  campaignId: string;
  recipientEmail: string;
  smtpServerId: string;
  status: 'sent' | 'failed' | 'bounced';
  error?: string;
  messageId?: string;
  openedAt?: string;
  clickedAt?: string;
  sentAt: string;
}

export interface VerificationResult {
  email: string;
  isValid: boolean;
  syntax: boolean;
  mx: boolean;
  smtp: boolean;
  disposable: boolean;
  role: boolean;
  score: number;
  error?: string;
}

export const SMTP_SERVERS_KEY = 'gammadyne_smtp_servers';
export const CAMPAIGNS_KEY = 'gammadyne_campaigns';
export const SEND_LOGS_KEY = 'gammadyne_send_logs';
export const RECIPIENT_LISTS_KEY = 'gammadyne_recipient_lists';
export const ROTATION_CONFIG_KEY = 'gammadyne_rotation_config';
