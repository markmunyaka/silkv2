import { SmtpServer, SMTP_SERVERS_KEY, ROTATION_CONFIG_KEY, RotationStrategy } from './types';

export type { RotationStrategy };

export class SmtpManager {
  private servers: SmtpServer[] = [];
  private rotationIndex: number = 0;
  private rotationStrategy: RotationStrategy = 'round-robin';

  constructor() {
    this.load();
  }

  private load(): void {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(SMTP_SERVERS_KEY);
    this.servers = stored ? JSON.parse(stored) : [];
    const rotStored = localStorage.getItem(ROTATION_CONFIG_KEY);
    if (rotStored) {
      const config = JSON.parse(rotStored);
      this.rotationStrategy = config.strategy || 'round-robin';
      this.rotationIndex = config.index || 0;
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SMTP_SERVERS_KEY, JSON.stringify(this.servers));
    localStorage.setItem(ROTATION_CONFIG_KEY, JSON.stringify({
      strategy: this.rotationStrategy,
      index: this.rotationIndex,
    }));
    window.dispatchEvent(new CustomEvent('smtp-servers-update', { detail: this.servers }));
  }

  getRotationStrategy(): RotationStrategy {
    return this.rotationStrategy;
  }

  setRotationStrategy(strategy: RotationStrategy): void {
    this.rotationStrategy = strategy;
    this.rotationIndex = 0;
    this.save();
  }

  getAll(): SmtpServer[] {
    return this.servers;
  }

  getActive(): SmtpServer[] {
    return this.servers.filter(s => s.isActive && s.isHealthy);
  }

  getById(id: string): SmtpServer | undefined {
    return this.servers.find(s => s.id === id);
  }

  add(server: Omit<SmtpServer, 'id' | 'createdAt' | 'sentToday' | 'sentThisHour' | 'failures' | 'isHealthy' | 'weight'>): SmtpServer {
    const newServer: SmtpServer = {
      ...server,
      weight: 1,
      failures: 0,
      isHealthy: true,
      id: `smtp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      createdAt: new Date().toISOString(),
      sentToday: 0,
      sentThisHour: 0,
    };
    this.servers.push(newServer);
    this.save();
    return newServer;
  }

  update(id: string, updates: Partial<SmtpServer>): SmtpServer | undefined {
    const idx = this.servers.findIndex(s => s.id === id);
    if (idx === -1) return undefined;
    this.servers[idx] = { ...this.servers[idx], ...updates };
    this.save();
    return this.servers[idx];
  }

  remove(id: string): boolean {
    const idx = this.servers.findIndex(s => s.id === id);
    if (idx === -1) return false;
    this.servers.splice(idx, 1);
    this.save();
    return true;
  }

  toggleActive(id: string): SmtpServer | undefined {
    const server = this.getById(id);
    if (!server) return undefined;
    return this.update(id, { isActive: !server.isActive });
  }

  recordSuccess(id: string): void {
    const server = this.getById(id);
    if (!server) return;
    this.update(id, {
      failures: 0,
      isHealthy: true,
      sentToday: server.sentToday + 1,
      sentThisHour: server.sentThisHour + 1,
      lastUsedAt: new Date().toISOString(),
    });
  }

  recordFailure(id: string): void {
    const server = this.getById(id);
    if (!server) return;
    const newFailures = server.failures + 1;
    this.update(id, {
      failures: newFailures,
      isHealthy: newFailures < 5, // mark unhealthy after 5 consecutive failures
    });
  }

  /**
   * Get next SMTP server based on rotation strategy
   */
  getNextAvailable(lastServerId?: string): SmtpServer | null {
    const active = this.getActive();
    if (active.length === 0) return null;

    // Reset daily/hourly counters if needed
    const now = new Date();
    active.forEach(server => {
      if (!server.lastUsedAt) return;
      const lastUsed = new Date(server.lastUsedAt);
      const daysDiff = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 1) server.sentToday = 0;
      const hoursDiff = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60);
      if (hoursDiff >= 1) server.sentThisHour = 0;
    });

    // Filter by capacity
    const available = active.filter(s => s.sentToday < s.maxEmailsPerDay && s.sentThisHour < s.maxEmailsPerHour);
    if (available.length === 0) return null;

    switch (this.rotationStrategy) {
      case 'round-robin':
        return this.roundRobin(available);
      case 'weighted':
        return this.weighted(available);
      case 'random':
        return available[Math.floor(Math.random() * available.length)];
      case 'failover':
        return this.failover(available);
      default:
        return this.roundRobin(available);
    }
  }

  private roundRobin(servers: SmtpServer[]): SmtpServer | null {
    if (servers.length === 0) return null;
    // Start after last used server
    const lastId = this.servers.find(s => s.lastUsedAt)?.id;
    const startIdx = lastId ? servers.findIndex(s => s.id === lastId) + 1 : 0;
    const idx = (startIdx + this.rotationIndex) % servers.length;
    this.rotationIndex = (this.rotationIndex + 1) % servers.length;
    this.save();
    return servers[idx];
  }

  private weighted(servers: SmtpServer[]): SmtpServer | null {
    const totalWeight = servers.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    for (const server of servers) {
      random -= server.weight;
      if (random <= 0) return server;
    }
    return servers[0];
  }

  private failover(servers: SmtpServer[]): SmtpServer | null {
    // Use the server with fewest failures
    return servers.reduce((best, current) => current.failures < best.failures ? current : best);
  }

  getStats() {
    const all = this.getAll();
    const active = this.getActive();
    return {
      totalServers: all.length,
      activeServers: active.length,
      totalSentToday: all.reduce((sum, s) => sum + s.sentToday, 0),
      totalCapacityToday: all.reduce((sum, s) => sum + s.maxEmailsPerDay, 0),
      rotationStrategy: this.rotationStrategy,
      servers: all.map(s => ({
        id: s.id,
        name: s.name,
        host: s.host,
        port: s.port,
        fromEmail: s.fromEmail,
        isActive: s.isActive,
        isHealthy: s.isHealthy,
        failures: s.failures,
        weight: s.weight,
        sentToday: s.sentToday,
        maxPerDay: s.maxEmailsPerDay,
        sentThisHour: s.sentThisHour,
        maxPerHour: s.maxEmailsPerHour,
        usagePercent: Math.round((s.sentToday / s.maxEmailsPerDay) * 100),
        lastUsedAt: s.lastUsedAt,
      })),
    };
  }
}

export const smtpManager = new SmtpManager();