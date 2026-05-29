/**
 * Email Rate Limiter - Prevents server blacklisting
 * Configurable per-domain and global limits for corporate email safety
 */

interface RateLimitConfig {
  /** Max emails per domain per window (e.g., corporate filters) */
  perDomain: number;
  /** Max emails per minute globally */
  perMinute: number;
  /** Max emails per hour globally */
  perHour: number;
  /** Cooldown between emails to same domain (ms) */
  domainCooldown: number;
  /** Minimum interval between any sends (ms) */
  globalCooldown: number;
}

interface DomainStats {
  count: number;
  windowStart: number;
  lastSent: number;
}

interface GlobalStats {
  minuteCount: number;
  minuteStart: number;
  hourCount: number;
  hourStart: number;
  lastSent: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  perDomain: 10,           // 10 emails per domain per 5-minute window (safe for Mimecast)
  perMinute: 30,          // 30 emails per minute global
  perHour: 500,           // 500 emails per hour global
  domainCooldown: 3000,   // 3 second delay between same-domain sends
  globalCooldown: 500,    // 500ms minimum between any sends
};

export class EmailRateLimiter {
  private config: RateLimitConfig;
  private domainStats: Map<string, DomainStats> = new Map();
  private globalStats: GlobalStats;
  private queue: Map<string, number> = new Map(); // domain -> queued count

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.globalStats = {
      minuteCount: 0,
      minuteStart: Date.now(),
      hourCount: 0,
      hourStart: Date.now(),
      lastSent: 0,
    };
  }

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string {
    return email.split('@')[1]?.toLowerCase() || 'unknown';
  }

  /**
   * Reset windows if they've expired
   */
  private resetExpiredWindows(): void {
    const now = Date.now();
    
    // Reset 5-minute domain windows
    this.domainStats.forEach((stats, domain) => {
      if (now - stats.windowStart > 5 * 60 * 1000) {
        this.domainStats.delete(domain);
      }
    });

    // Reset minute window
    if (now - this.globalStats.minuteStart > 60 * 1000) {
      this.globalStats.minuteCount = 0;
      this.globalStats.minuteStart = now;
    }

    // Reset hour window
    if (now - this.globalStats.hourStart > 60 * 60 * 1000) {
      this.globalStats.hourCount = 0;
      this.globalStats.hourStart = now;
    }
  }

  /**
   * Check if sending is allowed and get wait time if not
   */
  canSend(recipientEmail: string): { allowed: boolean; waitMs: number; reason?: string } {
    this.resetExpiredWindows();
    
    const domain = this.extractDomain(recipientEmail);
    const now = Date.now();
    
    // Check domain cooldown
    const domainStats = this.domainStats.get(domain);
    if (domainStats) {
      const domainCooldownRemaining = domainStats.lastSent + this.config.domainCooldown - now;
      if (domainCooldownRemaining > 0) {
        return { allowed: false, waitMs: domainCooldownRemaining, reason: `Domain cooldown: ${domain}` };
      }
    }

    // Check domain limit (10 per 5-min window)
    if (domainStats && domainStats.count >= this.config.perDomain) {
      const windowRemaining = (domainStats.windowStart + 5 * 60 * 1000) - now;
      return { allowed: false, waitMs: windowRemaining, reason: `Domain limit reached: ${domain}` };
    }

    // Check per-minute global limit
    if (this.globalStats.minuteCount >= this.config.perMinute) {
      const minuteRemaining = (this.globalStats.minuteStart + 60 * 1000) - now;
      return { allowed: false, waitMs: minuteRemaining, reason: 'Global per-minute limit' };
    }

    // Check per-hour global limit
    if (this.globalStats.hourCount >= this.config.perHour) {
      const hourRemaining = (this.globalStats.hourStart + 60 * 60 * 1000) - now;
      return { allowed: false, waitMs: hourRemaining, reason: 'Global per-hour limit' };
    }

    // Check global cooldown
    const globalCooldownRemaining = this.globalStats.lastSent + this.config.globalCooldown - now;
    if (globalCooldownRemaining > 0) {
      return { allowed: false, waitMs: globalCooldownRemaining, reason: 'Global cooldown' };
    }

    return { allowed: true, waitMs: 0 };
  }

  /**
   * Record a send event
   */
  recordSend(recipientEmail: string): void {
    const domain = this.extractDomain(recipientEmail);
    const now = Date.now();

    // Update domain stats
    const existing = this.domainStats.get(domain);
    if (existing) {
      existing.count++;
      existing.lastSent = now;
    } else {
      this.domainStats.set(domain, {
        count: 1,
        windowStart: now,
        lastSent: now,
      });
    }

    // Update global stats
    this.globalStats.minuteCount++;
    this.globalStats.hourCount++;
    this.globalStats.lastSent = now;
  }

  /**
   * Queue email for later sending with intelligent delay
   */
  async waitForSlot(recipientEmail: string): Promise<void> {
    const result = this.canSend(recipientEmail);
    if (result.allowed) return;
    
    console.log(`Rate limit: waiting ${result.waitMs}ms (${result.reason})`);
    await new Promise(resolve => setTimeout(resolve, result.waitMs));
    return this.waitForSlot(recipientEmail); // Recheck after waiting
  }

  /**
   * Get current stats for monitoring
   */
  getStats(): {
    global: { perMinute: number; perHour: number };
    domains: { domain: string; count: number }[];
  } {
    this.resetExpiredWindows();
    return {
      global: {
        perMinute: this.globalStats.minuteCount,
        perHour: this.globalStats.hourCount,
      },
      domains: Array.from(this.domainStats.entries()).map(([domain, stats]) => ({
        domain,
        count: stats.count,
      })),
    };
  }
}

// Singleton instance with safe defaults for corporate email
export const emailRateLimiter = new EmailRateLimiter({
  perDomain: 10,           // Conservative for Mimecast/strict filters
  perMinute: 25,          // Stay well under limits
  perHour: 400,           // Leave headroom
  domainCooldown: 2000,   // 2 seconds between same domain
  globalCooldown: 1000,   // 1 second global minimum
});
