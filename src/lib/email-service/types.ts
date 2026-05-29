export interface EmailConfig {
  provider: string;
  /** Custom headers for deliverability (SPF/DKIM/DMARC) */
  headers?: Record<string, string>;
  /** Authentication settings */
  dkim?: {
    domainName: string;
    privateKey: string;
    selector: string;
  };
  [key: string]: any;
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  customData?: Record<string, any>;
  /** Additional headers for corporate/B2B targeting */
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

export interface EmailBatch {
  emails: EmailPayload[];
  subject: string;
  htmlTemplate: string;
  batchId?: string;
}

export interface EmailValidationResult {
  valid: boolean;
  errors: string[];
}

export interface EmailProvider {
  name: string;
  send(payload: EmailPayload): Promise<EmailSendResult>;
  sendBatch(batch: EmailBatch): Promise<EmailSendResult[]>;
  validate(config: EmailConfig): EmailValidationResult;
  testConnection(): Promise<boolean>;
}
