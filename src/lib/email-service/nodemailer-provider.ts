import nodemailer, { Transporter } from 'nodemailer';
import { BaseEmailService } from './base';
import { EmailConfig, EmailPayload, EmailSendResult, EmailValidationResult } from './types';
import { EmailRateLimiter } from './rate-limiter';
import { IPRotator, IPRotationConfig } from './ip-rotator';

/**
 * Nodemailer Provider - Optimized for corporate email deliverability
 * Includes SPF/DKIM support, rate limiting, IP rotation, and B2B best practices
 */
export class NodemailerProvider extends BaseEmailService {
  name = 'nodemailer';
  private transporter: Transporter | null = null;
  private rateLimiter: EmailRateLimiter;
  private ipRotator: IPRotator | null = null;
  private currentServerIndex: number = 0;

  constructor(config: EmailConfig) {
    super(config);
    this.rateLimiter = new EmailRateLimiter({
      perDomain: 10,
      perMinute: 25,
      perHour: 400,
      domainCooldown: 2000,
      globalCooldown: 1000,
    });
    this.initializeTransporter();
    this.initializeIPRotator();
  }

  private initializeTransporter(serverIndex?: number) {
    let smtpConfig: any;

    // If IP rotation is enabled, use the specified server config
    if (this.ipRotator && serverIndex !== undefined) {
      const serverConfig = this.ipRotator.getServerConfig(serverIndex);
      if (serverConfig) {
        smtpConfig = {
          host: serverConfig.host,
          port: serverConfig.port,
          secure: serverConfig.secure,
          auth: {
            user: serverConfig.auth.user,
            pass: serverConfig.auth.pass,
          },
          localAddress: serverConfig.localAddress, // Bind to specific IP
          pool: true,
          maxConnections: 5,
          rateLimit: 5,
        };
      }
    }

    // Fallback to single server config
    if (!smtpConfig) {
      smtpConfig = {
        host: this.getConfig('host'),
        port: this.getConfig('port', 587),
        secure: this.getConfig('secure', false),
        auth: {
          user: this.getConfig('user'),
          pass: this.getConfig('password'),
        },
        localAddress: this.getConfig('localAddress'), // Bind to specific IP
        pool: true,
        maxConnections: 5,
        rateLimit: 5,
      };
    }

    this.transporter = nodemailer.createTransport(smtpConfig);
    this.currentServerIndex = serverIndex || 0;
  }

  /**
   * Initialize IP rotator if multiple servers configured
   */
  private initializeIPRotator() {
    const servers = this.getConfig('ipServers') as IPRotationConfig['servers'];
    const strategy = this.getConfig('ipRotationStrategy', 'round-robin') as IPRotationConfig['strategy'];

    if (servers && servers.length > 1) {
      this.ipRotator = new IPRotator({
        servers,
        strategy,
        maxFailures: 5,
      });
      console.log(`IP Rotator initialized with ${servers.length} servers, strategy: ${strategy}`);
    }
  }

  /**
   * Rotate to next server and update transporter
   */
  private rotateServer(): void {
    if (!this.ipRotator) return;

    const { index, server } = this.ipRotator.getNextServer();
    this.initializeTransporter(index);
    console.log(`Rotated to server ${index}: ${server.host}`);
  }

  /**
   * Get current server index
   */
  getCurrentServerIndex(): number {
    return this.currentServerIndex;
  }

  /**
   * Get IP rotation stats
   */
  getIPRotationStats() {
    return this.ipRotator?.getStats() || null;
  }

  /**
   * Build corporate-optimized headers for B2B deliverability
   * Includes professional headers for inbox placement
   */
  private buildHeaders(recipientEmail?: string): Record<string, string> {
    const headers: Record<string, string> = {};

    // List-Unsubscribe for CAN-SPAM compliance (required for bulk email)
    const fromEmail = (this.getConfig('from') || '') as string;
    const fromDomain = fromEmail.split('@')[1] || 'unknown';

    if (fromEmail) {
      headers['List-Unsubscribe'] = `<mailto:unsubscribe@${fromDomain}?subject=Unsubscribe>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    // Priority headers for corporate filters (Mimecast, Proofpoint, etc.)
    headers['X-Priority'] = '3'; // Normal priority (avoid '1' as it's spam-like)
    headers['X-MSMail-Priority'] = 'Normal';

    // Prevent threading issues and auto-responses
    headers['X-Auto-Response-Suppress'] = 'All';
    headers['Auto-Submitted'] = 'auto-generated';

    // Feedback loop for bounce handling (unique per campaign)
    const campaignId = Date.now().toString(36);
    headers['Feedback-ID'] = `campaign:${campaignId}:${fromDomain}`;

    // Clean Message-ID format following RFC 5322 for proper threading
    headers['Message-ID'] = this.generateMessageId(fromDomain);

    // X-Entity-Ref-ID to prevent duplicate detection in email clients
    headers['X-Entity-Ref-ID'] = `<${Date.now()}-${this.randomId()}@${fromDomain}>`;

    // MIME headers for better rendering
    headers['MIME-Version'] = '1.0';
    headers['Content-Type'] = 'text/html; charset=UTF-8';

    // Add custom headers from config
    const customHeaders = this.getConfig('headers', {});
    Object.assign(headers, customHeaders);

    return headers;
  }

  /**
   * Generate clean Message-ID following RFC 5322
   * Format: <timestamp.random@domain>
   */
  private generateMessageId(domain: string): string {
    const timestamp = Date.now().toString(36);
    const random = this.randomId();
    return `<${timestamp}.${random}@${domain}>`;
  }

  /**
   * Generate random ID for message tracking
   */
  private randomId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  /**
   * Validate and sanitize From address for B2B
   */
  private validateFromAddress(from?: string): string | undefined {
    if (!from) return undefined;

    // Ensure From uses a proper display format
    const fromName = this.getConfig('fromName', '');
    if (fromName) {
      return `"${fromName}" <${from}>`;
    }

    return from;
  }

  /**
   * Build Reply-To with business validation
   */
  private buildReplyTo(replyTo?: string): string | undefined {
    if (!replyTo) {
      // Default to From if no Reply-To specified (corporate best practice)
      return undefined; // Let Nodemailer use from
    }

    // Validate Reply-To is a business email, not free providers
    const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
    const replyToDomain = replyTo.split('@')[1]?.toLowerCase();

    if (freeProviders.includes(replyToDomain)) {
      console.warn('Reply-To should be a business domain, not:', replyToDomain);
    }

    return replyTo;
  }

  /**
   * Get wait time before sending for rate limiting
   */
  async checkRateLimit(recipientEmail: string): Promise<{ canSend: boolean; waitMs: number }> {
    const result = this.rateLimiter.canSend(recipientEmail);
    return { canSend: result.allowed, waitMs: result.waitMs };
  }

  async send(payload: EmailPayload): Promise<EmailSendResult> {
    try {
      if (!this.transporter) {
        throw new Error('Transporter not initialized');
      }

      // Check rate limit before sending
      const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
      for (const recipient of recipients) {
        const { canSend, waitMs } = await this.checkRateLimit(recipient);
        if (!canSend) {
          // Privacy: No logging of email addresses
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
      }

      // Build email options with corporate optimization
      const mailOptions: Record<string, any> = {
        from: this.validateFromAddress(payload.from || this.getConfig('from')),
        to: recipients.join(','),
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        // Corporate-friendly headers
        headers: {
          ...this.buildHeaders(),
          ...payload.headers,
        },
      };

      // Reply-To with business validation
      if (payload.replyTo) {
        mailOptions.replyTo = this.buildReplyTo(payload.replyTo);
      }

      // CC/BCC handling
      if (payload.cc) {
        mailOptions.cc = Array.isArray(payload.cc) ? payload.cc.join(',') : payload.cc;
      }
      if (payload.bcc) {
        mailOptions.bcc = Array.isArray(payload.bcc) ? payload.bcc.join(',') : payload.bcc;
      }

      // Attachments
      if (payload.attachments && payload.attachments.length > 0) {
        mailOptions.attachments = payload.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        }));
      }

      const info = await this.transporter.sendMail(mailOptions);

      // Record successful sends for rate limiting
      for (const recipient of recipients) {
        this.rateLimiter.recordSend(recipient);
      }

      // Record successful send for IP rotation
      if (this.ipRotator) {
        this.ipRotator.recordSuccess(this.currentServerIndex);
      }

      return {
        success: true,
        messageId: info.messageId,
        timestamp: new Date(),
      };
    } catch (error) {
      // Record failure for IP rotation and potentially rotate
      if (this.ipRotator) {
        this.ipRotator.recordFailure(this.currentServerIndex, error instanceof Error ? error.message : 'Unknown error');
        // Auto-rotate to next healthy server on failure
        if (this.ipRotator.getHealthyCount() > 1) {
          this.rotateServer();
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Send batch with intelligent rate limiting and IP rotation
   */
  async sendBatchWithRateLimit(
    batch: Array<{ recipient: string; payload: EmailPayload }>,
    onProgress?: (sent: number, total: number) => void
  ): Promise<{ sent: number; failed: number; results: EmailSendResult[] }> {
    const results: EmailSendResult[] = [];
    let sent = 0;
    let failed = 0;
    
    // Calculate rotation interval based on batch size and healthy servers
    const healthyCount = this.ipRotator?.getHealthyCount() || 1;
    const rotationInterval = Math.max(10, Math.floor(batch.length / (healthyCount * 10)));
    let emailsSinceLastRotation = 0;

    for (let i = 0; i < batch.length; i++) {
      const { recipient, payload } = batch[i];

      try {
        // Rotate IP if needed (distributes load across IPs)
        if (this.ipRotator && emailsSinceLastRotation >= rotationInterval) {
          this.rotateServer();
          emailsSinceLastRotation = 0;
        }

        // Wait for rate limit slot
        await this.rateLimiter.waitForSlot(recipient);

        // Send email
        const result = await this.send({ ...payload, to: recipient });
        results.push(result);

        if (result.success) {
          sent++;
        } else {
          failed++;
        }
        
        emailsSinceLastRotation++;

        // Report progress
        if (onProgress) {
          onProgress(sent + failed, batch.length);
        }
      } catch (error) {
        failed++;
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Batch send failed',
          timestamp: new Date(),
        });
      }
    }

    return { sent, failed, results };
  }

  validate(config: EmailConfig): EmailValidationResult {
    const errors: string[] = [];

    if (!config.host) {
      errors.push('SMTP host is required');
    }

    if (!config.user) {
      errors.push('SMTP user is required');
    }

    if (!config.password) {
      errors.push('SMTP password is required');
    }

    if (config.port && (typeof config.port !== 'number' || config.port < 1 || config.port > 65535)) {
      errors.push('SMTP port must be a valid number between 1 and 65535');
    }

    // Validate from address for B2B deliverability
    if (config.from) {
      const fromDomain = config.from.split('@')[1];
      if (!fromDomain) {
        errors.push('From email must have a valid domain');
      } else {
        // Warn about free email providers
        const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
        if (freeProviders.includes(fromDomain.toLowerCase())) {
          errors.push('From email should be a business domain, not a free provider');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.transporter) {
        return false;
      }
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get rate limiter stats for monitoring
   */
  getRateLimitStats() {
    return this.rateLimiter.getStats();
  }
}