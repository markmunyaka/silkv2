declare module 'nodemailer' {
  export interface Transporter {
    sendMail(options: any): Promise<any>;
    verify(): Promise<boolean>;
  }

  export interface SendMailOptions {
    from?: string;
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
    cc?: string;
    bcc?: string;
    replyTo?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>;
    headers?: Record<string, string>;
  }

  export function createTransport(config: any): Transporter;
}