'use client';

import { useState, useEffect } from 'react';
import type { SystemMetrics, AdminApiResponse } from '@/types/admin';

export default function AdminAnalyticsPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/admin/system');
        const json: AdminApiResponse<{ metrics: SystemMetrics; logs: unknown[] }> = await res.json();
        if (json.ok && json.data) setMetrics(json.data.metrics);
      } catch (err) {
        console.error('Failed to fetch metrics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-serif text-white mb-1">Analytics</h1>
        <p className="text-foreground-secondary text-sm">Platform-wide performance and usage statistics</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-foreground-secondary">Loading analytics...</div>
      ) : metrics ? (
        <>
          {/* Metrics grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard label="API Latency" value={`${metrics.apiLatencyMs}ms`} icon="⚡" gradient="from-accent-neon-blue/20 to-accent-neon-blue/5" />
            <MetricCard label="LLM Tokens Today" value={metrics.llmTokensConsumed.toLocaleString()} icon="🧠" gradient="from-accent-gold/20 to-accent-gold/5" />
            <MetricCard label="Active Workers" value={String(metrics.activeWorkers)} icon="⚙️" gradient="from-emerald-500/20 to-emerald-500/5" />
            <MetricCard label="System Uptime" value={`${metrics.uptimeHours}h`} icon="🟢" gradient="from-emerald-500/20 to-emerald-500/5" />
            <MetricCard label="Memory" value={`${metrics.memoryUsageMb} MB`} icon="💾" gradient="from-accent-neon-blue/20 to-accent-neon-blue/5" />
            <MetricCard label="Database" value={`${metrics.dbSizeMb} MB`} icon="🗄️" gradient="from-accent-gold/20 to-accent-gold/5" />
          </div>

          {/* Usage summary */}
          <div className="glass-lg rounded-xl border border-white/5 p-6">
            <h3 className="text-lg font-serif text-white mb-4">📈 Usage Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-2xl font-serif font-bold text-accent-gold">—</p>
                <p className="text-xs text-foreground-secondary mt-1">Total documents processed this week</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-2xl font-serif font-bold text-accent-neon-blue">—</p>
                <p className="text-xs text-foreground-secondary mt-1">Videos generated</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-2xl font-serif font-bold text-emerald-400">—</p>
                <p className="text-xs text-foreground-secondary mt-1">Emails sent</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-2xl font-serif font-bold text-purple-400">—</p>
                <p className="text-xs text-foreground-secondary mt-1">Leads scraped</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 text-foreground-secondary">Could not load analytics data.</div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, gradient }: { label: string; value: string; icon: string; gradient: string }) {
  return (
    <div className="glass-lg p-5 rounded-xl border border-white/10 hover:shadow-xl hover:shadow-accent-gold/10 transition-all duration-300 relative overflow-hidden group">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl">{icon}</span>
        </div>
        <p className="text-2xl font-serif font-bold text-white mb-0.5">{value}</p>
        <p className="text-xs text-foreground-secondary">{label}</p>
      </div>
    </div>
  );
}