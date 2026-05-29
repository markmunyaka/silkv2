import { EmailConfig, EmailProvider } from './types';
import { NodemailerProvider } from './nodemailer-provider';
import { SendGridProvider } from './sendgrid-provider';
import { MailgunProvider } from './mailgun-provider';
import { SESProvider } from './ses-provider';

export class EmailServiceFactory {
  static createService(provider: string, config: EmailConfig): EmailProvider {
    switch (provider.toLowerCase()) {
      case 'nodemailer':
        return new NodemailerProvider(config);
      case 'sendgrid':
        return new SendGridProvider(config);
      case 'mailgun':
        return new MailgunProvider(config);
      case 'ses':
      case 'aws':
        return new SESProvider(config);
      default:
        throw new Error(`Unknown email provider: ${provider}`);
    }
  }

  static getAvailableProviders(): string[] {
    return ['nodemailer', 'sendgrid', 'mailgun', 'ses'];
  }

  static validateConfig(provider: string, config: EmailConfig): { valid: boolean; errors: string[] } {
    try {
      const service = this.createService(provider, config);
      return service.validate(config);
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      };
    }
  }

  static async testProviderConnection(
    provider: string,
    config: EmailConfig
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const service = this.createService(provider, config);
      const connected = await service.testConnection();
      return {
        success: connected,
        error: connected ? undefined : 'Failed to connect to email service',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
