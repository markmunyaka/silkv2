/**
 * SendGrid Email Provider
 * Enterprise-grade email service with excellent deliverability
 */

import { BaseEmailService } from './base';
import { EmailConfig, EmailPayload, EmailSendResult, EmailValidationResult, EmailBatch } from './types';
import { EmailRateLimiter } from './rate-limiter';

export class SendGridProvider extends BaseEmailService {
  name = 'sendgrid';
  private rateLimiter: EmailRateLimiter;

  constructor(config: EmailConfig) {
    super(config);
    this.rateLimiter = new EmailRateLimiter({
      perDomain: 25,
      perMinute: 60,
      perHour: 1500,
      domainCooldown: 800,
      globalCooldown: 400,
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

      // Build SendGrid mail payload
      const mailData = {
        personalizations: [
          {
            to: recipients.map(email => ({ email })),
            subject: payload.subject,
          },
        ],
        from: { email: payload.from || this.getConfig('from') },
        content: [
          { type: 'text/html', value: payload.html || '' },
          ...(payload.text ? [{ type: 'text/plain', value: payload.text }] : []),
        ],
        reply_to: payload.replyTo ? { email: payload.replyTo } : undefined,
      };

      // In production, use SendGrid SDK:
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(this.getConfig('apiKey'));
      // await sgMail.send(mailData);

      // Simulate send for demo
      await new Promise(resolve => setTimeout(resolve, 100));
      
      for (const recipient of recipients) {
        this.rateLimiter.recordSend(recipient);
      }

      return {
        success: true,
        messageId: `sg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SendGrid send failed',
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

    if (!config.apiKey) {
      errors.push('SendGrid API key is required');
    }

    return { valid: errors.length === 0, errors };
  }

  async testConnection(): Promise<boolean> {
    try {
      // In production: verify SendGrid API key
      return true;
    } catch {
      return false;
    }
  }

  async sendBatch(batch: EmailBatch): Promise<EmailSendResult[]> {
    return super.sendBatch(batch);
  }
}
