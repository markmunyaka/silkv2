import { Campaign, SmtpServer, SendLog, SEND_LOGS_KEY, CAMPAIGNS_KEY } from './types';
import { smtpManager } from './smtp-manager';

export class CampaignEngine {
  private campaigns: Campaign[] = [];
  private logs: SendLog[] = [];
  private isRunning = false;
  private abortController: AbortController | null = null;

  constructor() {
    this.load();
  }

  private load(): void {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(CAMPAIGNS_KEY);
    this.campaigns = stored ? JSON.parse(stored) : [];
    const logStored = localStorage.getItem(SEND_LOGS_KEY);
    this.logs = logStored ? JSON.parse(logStored) : [];
  }

  private saveCampaigns(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(this.campaigns));
    window.dispatchEvent(new CustomEvent('campaigns-update', { detail: this.campaigns }));
  }

  private saveLogs(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SEND_LOGS_KEY, JSON.stringify(this.logs));
  }

  getCampaigns(): Campaign[] {
    return this.campaigns;
  }

  getCampaign(id: string): Campaign | undefined {
    return this.campaigns.find(c => c.id === id);
  }

  getLogs(campaignId: string): SendLog[] {
    return this.logs.filter(l => l.campaignId === campaignId);
  }

  addCampaign(campaign: Campaign): Campaign {
    this.campaigns.unshift(campaign);
    this.saveCampaigns();
    return campaign;
  }

  updateCampaign(id: string, updates: Partial<Campaign>): void {
    const idx = this.campaigns.findIndex(c => c.id === id);
    if (idx === -1) return;
    this.campaigns[idx] = { ...this.campaigns[idx], ...updates };
    this.saveCampaigns();
  }

  /**
   * Apply mail merge to replace {{placeholders}} with recipient data
   */
  applyMailMerge(html: string, subject: string, recipient: { email: string; firstName?: string; lastName?: string; company?: string; position?: string; customFields?: Record<string, string> }): { html: string; subject: string } {
    let mergedHtml = html;
    let mergedSubject = subject;

    const fields: Record<string, string> = {
      '{{email}}': recipient.email,
      '{{firstName}}': recipient.firstName || '',
      '{{lastName}}': recipient.lastName || '',
      '{{fullName}}': [recipient.firstName, recipient.lastName].filter(Boolean).join(' '),
      '{{company}}': recipient.company || '',
      '{{position}}': recipient.position || '',
    };

    // Add custom fields
    if (recipient.customFields) {
      for (const [key, value] of Object.entries(recipient.customFields)) {
        fields[`{{${key}}}`] = value || '';
      }
    }

    // Add tracking pixel if enabled
    for (const [placeholder, value] of Object.entries(fields)) {
      mergedHtml = mergedHtml.replaceAll(placeholder, value);
      mergedSubject = mergedSubject.replaceAll(placeholder, value);
    }

    return { html: mergedHtml, subject: mergedSubject };
  }

  /**
   * Send a campaign asynchronously with progress callbacks
   */
  async sendCampaign(
    campaign: Campaign,
    recipients: Array<{ email: string; firstName?: string; lastName?: string; company?: string; position?: string; customFields?: Record<string, string> }>,
    onProgress?: (sent: number, failed: number, total: number, currentEmail: string) => void,
    onLog?: (log: SendLog) => void,
  ): Promise<void> {
    if (this.isRunning) throw new Error('Campaign engine is already running');
    this.isRunning = true;
    this.abortController = new AbortController();

    try {
      this.updateCampaign(campaign.id, { status: 'sending' });

      let sentCount = 0;
      let failedCount = 0;
      let lastServerId: string | undefined;

      for (let i = 0; i < recipients.length; i++) {
        if (this.abortController.signal.aborted) {
          this.updateCampaign(campaign.id, { status: 'paused' });
          return;
        }

        const recipient = recipients[i];

        // Get next available SMTP server
        const server = smtpManager.getNextAvailable(lastServerId);
        if (!server) {
          // All servers exhausted, pause campaign
          this.updateCampaign(campaign.id, { status: 'paused' });
          return;
        }
        lastServerId = server.id;

        // Apply mail merge
        const { html, subject } = this.applyMailMerge(campaign.htmlContent, campaign.subject, recipient);

        try {
          // Simulate real SMTP send (in production, use actual nodemailer)
          const messageId = `<${Date.now().toString(36)}.${Math.random().toString(36).substring(2, 10)}@${server.fromEmail.split('@')[1]}>`;

          // Simulate send delay based on server config
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, server.delayBetweenEmailsMs || 100);
            this.abortController!.signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('Aborted'));
            });
          });

          // Record success
          smtpManager.recordSuccess(server.id);
          sentCount++;

          const log: SendLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            campaignId: campaign.id,
            recipientEmail: recipient.email,
            smtpServerId: server.id,
            status: 'sent',
            messageId,
            sentAt: new Date().toISOString(),
          };

          this.logs.push(log);
          this.saveLogs();
          if (onLog) onLog(log);

        } catch (err: any) {
          if (err.message === 'Aborted') break;
          failedCount++;

          const log: SendLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            campaignId: campaign.id,
            recipientEmail: recipient.email,
            smtpServerId: server.id,
            status: 'failed',
            error: err.message || 'Send failed',
            sentAt: new Date().toISOString(),
          };

          this.logs.push(log);
          this.saveLogs();
          if (onLog) onLog(log);
        }

        // Report progress
        if (onProgress) {
          onProgress(sentCount, failedCount, recipients.length, recipient.email);
        }
      }

      // Mark campaign as completed
      this.updateCampaign(campaign.id, {
        status: 'completed',
        sentCount,
        failedCount,
        completedAt: new Date().toISOString(),
      });

    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  /**
   * Pause a running campaign
   */
  pauseCampaign(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Get dashboard stats
   */
  getStats() {
    const totalSent = this.logs.filter(l => l.status === 'sent').length;
    const totalFailed = this.logs.filter(l => l.status === 'failed').length;
    const totalBounced = this.logs.filter(l => l.status === 'bounced').length;
    const smtpStats = smtpManager.getStats();

    return {
      totalCampaigns: this.campaigns.length,
      activeCampaigns: this.campaigns.filter(c => c.status === 'sending').length,
      totalSent,
      totalFailed,
      totalBounced,
      bounceRate: totalSent > 0 ? Math.round((totalBounced / (totalSent + totalFailed)) * 100) : 0,
      ...smtpStats,
    };
  }
}

export const campaignEngine = new CampaignEngine();