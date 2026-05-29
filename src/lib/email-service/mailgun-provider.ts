/**
 * Mailgun Email Provider
 * Simple API-based email service with good deliverability
 */

import { BaseEmailService } from './base';
import { EmailConfig, EmailPayload, EmailSendResult, EmailValidationResult, EmailBatch } from './types';
import { EmailRateLimiter } from './rate-limiter';

export class MailgunProvider extends BaseEmailService {
  name = 'mailgun';
  private rateLimiter: EmailRateLimiter;

  constructor(config: EmailConfig) {
    super(config);
    this.rateLimiter = new EmailRateLimiter({
      perDomain: 15,
      perMinute: 40,
      perHour: 800,
      domainCooldown: 1500,
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

      // Build Mailgun API payload
      const formData = new URLSearchParams();
      formData.append('from', payload.from || this.getConfig('from'));
      recipients.forEach(r => formData.append('to', r));
      formData.append('subject', payload.subject);
      formData.append('html', payload.html || '');
      if (payload.text) formData.append('text', payload.text);
      if (payload.replyTo) formData.append('h:Reply-To', payload.replyTo);

      // In production, use fetch to Mailgun API:
      // const domain = this.getConfig('domain');
      // const apiKey = this.getConfig('apiKey');
      // const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': 'Basic ' + btoa(`api:${apiKey}`),
      //     'Content-Type': 'application/x-www-form-urlencoded',
      //   },
      //   body: formData.toString(),
      // });

      // Simulate send for demo
      await new Promise(resolve => setTimeout(resolve, 100));
      
      for (const recipient of recipients) {
        this.rateLimiter.recordSend(recipient);
      }

      return {
        success: true,
        messageId: `mg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Mailgun send failed',
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

    if (!config.domain) {
      errors.push('Mailgun domain is required (e.g., mg.yourdomain.com)');
    }

    if (!config.apiKey) {
      errors.push('Mailgun API key is required');
    }

    return { valid: errors.length === 0, errors };
  }

  async testConnection(): Promise<boolean> {
    try {
      // In production: verify Mailgun domain
      return true;
    } catch {
      return false;
    }
  }

  async sendBatch(batch: EmailBatch): Promise<EmailSendResult[]> {
    return super.sendBatch(batch);
  }
}