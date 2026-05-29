import { EmailConfig, EmailPayload, EmailSendResult, EmailBatch, EmailValidationResult, EmailProvider } from './types';

export abstract class BaseEmailService implements EmailProvider {
  abstract name: string;
  protected config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  abstract send(payload: EmailPayload): Promise<EmailSendResult>;

  async sendBatch(batch: EmailBatch): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];

    for (const email of batch.emails) {
      try {
        const payload: EmailPayload = {
          ...email,
          subject: batch.subject,
          html: this.renderTemplate(batch.htmlTemplate, email.customData || {}),
        };
        const result = await this.send(payload);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  abstract validate(config: EmailConfig): EmailValidationResult;

  abstract testConnection(): Promise<boolean>;

  protected validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  protected validateEmails(emails: string | string[]): boolean {
    const emailList = Array.isArray(emails) ? emails : [emails];
    return emailList.every(email => this.validateEmail(email));
  }

  protected renderTemplate(template: string, data: Record<string, any>): string {
    let html = template;
    Object.keys(data).forEach(key => {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(placeholder, String(data[key]));
    });
    return html;
  }

  protected getConfig<T = any>(key: string, defaultValue?: T): T {
    return this.config[key] || defaultValue;
  }
}
