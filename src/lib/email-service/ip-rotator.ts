/**
 * IP Rotator - Distributes email sending across multiple IPs
 * Reduces risk of any single IP getting blacklisted
 * Essential for high-volume email campaigns
 */

import { EmailPayload, EmailSendResult } from './types';

export interface IPRotationConfig {
  /** List of SMTP server configurations with different IPs */
  servers: Array<{
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    /** Optional: binding IP for this server */
    localAddress?: string;
    /** Weight for load distribution (higher = more likely to be chosen) */
    weight?: number;
  }>;
  /** Strategy: 'round-robin', 'weighted', 'random', 'failover' */
  strategy: 'round-robin' | 'weighted' | 'random' | 'failover';
  /** Health check interval in ms */
  healthCheckInterval?: number;
  /** Max consecutive failures before marking IP unhealthy */
  maxFailures?: number;
}

interface ServerHealth {
  failures: number;
  lastFailure: number;
  lastSuccess: number;
  isHealthy: boolean;
  sends: number;
}

export class IPRotator {
  private servers: IPRotationConfig['servers'];
  private strategy: IPRotationConfig['strategy'];
  private healthCheckInterval: number;
  private maxFailures: number;
  private serverHealth: Map<number, ServerHealth>;
  private roundRobinIndex: number;
  private totalSends: number;

  constructor(config: IPRotationConfig) {
    this.servers = config.servers;
    this.strategy = config.strategy;
    this.healthCheckInterval = config.healthCheckInterval || 60000; // 1 minute
    this.maxFailures = config.maxFailures || 5;
    this.serverHealth = new Map();
    this.roundRobinIndex = 0;
    this.totalSends = 0;

    // Initialize health for each server
    this.servers.forEach((_, index) => {
      this.serverHealth.set(index, {
        failures: 0,
        lastFailure: 0,
        lastSuccess: 0,
        isHealthy: true,
        sends: 0,
      });
    });
  }

  /**
   * Get the next available server based on strategy
   */
  getNextServer(): { index: number; server: IPRotationConfig['servers'][0] } {
    const healthyServers = this.getHealthyServers();

    if (healthyServers.length === 0) {
      // All unhealthy, return first server (failover)
      const index = 0;
      return { index, server: this.servers[index] };
    }

    switch (this.strategy) {
      case 'round-robin':
        return this.getRoundRobinServer(healthyServers);
      case 'weighted':
        return this.getWeightedServer(healthyServers);
      case 'random':
        return this.getRandomServer(healthyServers);
      case 'failover':
        return this.getFailoverServer(healthyServers);
      default:
        return this.getRoundRobinServer(healthyServers);
    }
  }

  /**
   * Get healthy servers only
   */
  private getHealthyServers(): Array<{ index: number; server: IPRotationConfig['servers'][0] }> {
    const result: Array<{ index: number; server: IPRotationConfig['servers'][0] }> = [];

    this.servers.forEach((server, index) => {
      const health = this.serverHealth.get(index);
      if (health?.isHealthy !== false) {
        result.push({ index, server });
      }
    });

    return result;
  }

  /**
   * Round-robin selection
   */
  private getRoundRobinServer(healthy: Array<{ index: number; server: any }>) {
    let serverIndex = this.roundRobinIndex;
    
    // Find the actual index in the full servers array
    const actualServer = healthy.find(s => {
      // Find position in original array
      let pos = 0;
      for (let i = 0; i < this.servers.length; i++) {
        if (this.servers[i] === s.server) {
          pos = i;
          break;
        }
      }
      return pos >= serverIndex;
    });

    if (!actualServer) {
      // Wrap around
      this.roundRobinIndex = 0;
      serverIndex = 0;
    } else {
      this.roundRobinIndex++;
      if (this.roundRobinIndex >= this.servers.length) {
        this.roundRobinIndex = 0;
      }
    }

    return actualServer || healthy[0];
  }

  /**
   * Weighted selection based on weight property
   */
  private getWeightedServer(healthy: Array<{ index: number; server: any }>) {
    const totalWeight = healthy.reduce((sum, s) => sum + (s.server.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const s of healthy) {
      random -= (s.server.weight || 1);
      if (random <= 0) {
        return s;
      }
    }

    return healthy[0];
  }

  /**
   * Random selection
   */
  private getRandomServer(healthy: Array<{ index: number; server: any }>) {
    const randomIndex = Math.floor(Math.random() * healthy.length);
    return healthy[randomIndex];
  }

  /**
   * Failover: use first healthy server, rotate on failure
   */
  private getFailoverServer(healthy: Array<{ index: number; server: any }>) {
    // Use server with lowest failure count
    return healthy.reduce((best, current) => {
      const bestHealth = this.serverHealth.get(best.index);
      const currentHealth = this.serverHealth.get(current.index);
      return (currentHealth?.failures || 0) < (bestHealth?.failures || 0) ? current : best;
    });
  }

  /**
   * Record a successful send
   */
  recordSuccess(serverIndex: number): void {
    const health = this.serverHealth.get(serverIndex);
    if (health) {
      health.lastSuccess = Date.now();
      health.failures = 0; // Reset on success
      health.isHealthy = true;
      health.sends++;
    }
    this.totalSends++;
  }

  /**
   * Record a failed send
   */
  recordFailure(serverIndex: number, error?: string): void {
    const health = this.serverHealth.get(serverIndex);
    if (health) {
      health.lastFailure = Date.now();
      health.failures++;

      // Mark unhealthy if too many failures
      if (health.failures >= this.maxFailures) {
        health.isHealthy = false;
        console.warn(`IP Rotator: Server ${serverIndex} marked unhealthy after ${health.failures} failures`);
      }
    }
  }

  /**
   * Get statistics for all servers
   */
  getStats(): {
    totalSends: number;
    servers: Array<{
      host: string;
      health: ServerHealth;
      percentage: number;
    }>;
  } {
    const serverStats = this.servers.map((server, index) => {
      const health = this.serverHealth.get(index)!;
      return {
        host: server.host,
        health,
        percentage: this.totalSends > 0 ? Math.round((health.sends / this.totalSends) * 100) : 0,
      };
    });

    return {
      totalSends: this.totalSends,
      servers: serverStats,
    };
  }

  /**
   * Force recheck of all servers
   */
  recheckServers(): void {
    this.serverHealth.forEach((health, index) => {
      if (!health.isHealthy) {
        // Try to re-enable after cooldown (5 minutes)
        if (Date.now() - health.lastFailure > 5 * 60 * 1000) {
          health.isHealthy = true;
          health.failures = 0;
          console.log(`IP Rotator: Server ${index} re-enabled after cooldown`);
        }
      }
    });
  }

  /**
   * Get current SMTP config for a server
   */
  getServerConfig(index: number): IPRotationConfig['servers'][0] | null {
    return this.servers[index] || null;
  }

  /**
   * Get count of healthy servers
   */
  getHealthyCount(): number {
    return this.getHealthyServers().length;
  }
}

// Factory for creating IP rotators
export class IPRotationFactory {
  private static rotators: Map<string, IPRotator> = new Map();

  static create(name: string, config: IPRotationConfig): IPRotator {
    const rotator = new IPRotator(config);
    this.rotators.set(name, rotator);
    return rotator;
  }

  static get(name: string): IPRotator | undefined {
    return this.rotators.get(name);
  }

  static getAll(): Map<string, IPRotator> {
    return this.rotators;
  }
}
