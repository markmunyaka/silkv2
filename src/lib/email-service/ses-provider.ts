/**
 * AWS SES Email Provider
 * High deliverability with AWS infrastructure
 */

import { BaseEmailService } from './base';
import { EmailConfig, EmailPayload, EmailSendResult, EmailValidationResult, EmailBatch } from './types';
import { EmailRateLimiter } from './rate-limiter';

export class SESProvider extends BaseEmailService {
  name = 'ses';
  private rateLimiter: EmailRateLimiter;

  constructor(config: EmailConfig) {
    super(config);
    this.rateLimiter = new EmailRateLimiter({
      perDomain: 20,
      perMinute: 50,
      perHour: 1000,
      domainCooldown: 1000,
      globalCooldown: 500,
    });
  }

  async send(payload: EmailPayload): Promise<EmailSendResult> {
    try {
      const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];

      // Check rate limit
      for (const recipient of recipients) {
        const { canSend, waitMs } = await this.checkRateLimit(recipient);
        if (!canSend) {
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
      }

      // Build AWS SES params
      const params = {
        Source: payload.from || this.getConfig('from'),
        Destination: {
          ToAddresses: recipients,
          CcAddresses: payload.cc ? (Array.isArray(payload.cc) ? payload.cc : [payload.cc]) : undefined,
          BccAddresses: payload.bcc ? (Array.isArray(payload.bcc) ? payload.bcc : [payload.bcc]) : undefined,
        },
        Message: {
          Subject: {
            Data: payload.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: payload.html || '',
              Charset: 'UTF-8',
            },
            Text: {
              Data: payload.text || '',
              Charset: 'UTF-8',
            },
          },
        },
        ReplyToAddresses: payload.replyTo ? [payload.replyTo] : undefined,
      };

      // In production, use AWS SDK:
      // const SES = require('@aws-sdk/client-ses');
      // const client = new SES.SESClient({ region: this.getConfig('region', 'us-east-1') });
      // const command = new SES.SendEmailCommand(params);
      // const result = await client.send(command);

      // Simulate send for demo
      await new Promise(resolve => setTimeout(resolve, 100));
      
      for (const recipient of recipients) {
        this.rateLimiter.recordSend(recipient);
      }

      return {
        success: true,
        messageId: `ses-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SES send failed',
        timestamp: new Date(),
      };
    }
  }

  async checkRateLimit(recipientEmail: string): Promise<{ canSend: boolean; waitMs: number }> {
    const result = this.rateLimiter.canSend(recipientEmail);
    return { canSend: result.allowed, waitMs: result.waitMs };
  }

  validate(config: EmailConfig): EmailValidationResult {
    const errors: string[] = [];

    if (!config.region && !config.host) {
      errors.push('AWS region is required (e.g., us-east-1)');
    }

    if (!config.accessKeyId) {
      errors.push('AWS Access Key ID is required');
    }

    if (!config.secretAccessKey) {
      errors.push('AWS Secret Access Key is required');
    }

    return { valid: errors.length === 0, errors };
  }

  async testConnection(): Promise<boolean> {
    try {
      // In production: verify SES credentials
      return true;
    } catch {
      return false;
    }
  }

  async sendBatch(batch: EmailBatch): Promise<EmailSendResult[]> {
    return super.sendBatch(batch);
  }
}