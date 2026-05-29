'use client';

import { useState } from 'react';

interface ScrapedResult {
  id: string;
  companyName: string;
  website: string | null;
  email: string | null;
  status: string;
}

interface ScraperResponse {
  total: number;
  enriched: number;
  leads: ScrapedResult[];
  source: string;
}

export default function LeadScraperCard() {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState(10);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScraperResponse | null>(null);
  const [error, setError] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ inserted: number; skipped: number } | null>(null);

  const handleSearch = async () => {
    if (!query.trim() || !location.trim()) return;

    setLoading(true);
    setError('');
    setResults(null);
    setSelectedLeadIds(new Set());
    setPushResult(null);

    try {
      const res = await fetch('/api/scraper/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), location: location.trim(), maxResults }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleLead = (id: string) => {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedLeadIds(next);
  };

  const toggleAll = () => {
    if (!results) return;
    if (selectedLeadIds.size === results.leads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(results.leads.map((l) => l.id)));
    }
  };

  const handlePushToMailer = async () => {
    if (selectedLeadIds.size === 0) return;

    setPushing(true);
    setPushResult(null);

    try {
      const res = await fetch('/api/scraper/push-to-mailer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedLeadIds) }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Push failed');
      }

      setPushResult({ inserted: data.inserted, skipped: data.skipped.length });
      setSelectedLeadIds(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to push to mailer');
    } finally {
      setPushing(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'enriched': return 'text-emerald-400';
      case 'discovered': return 'text-amber-400';
      case 'failed': return 'text-red-400';
      case 'pushed': return 'text-accent-neon-blue';
      default: return 'text-foreground-secondary';
    }
  };

  return (
    <div className="glass-lg p-6 rounded-lg">
      <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
        <span>📊</span> B2B Lead Scraper
      </h3>
      <p className="text-foreground-secondary text-sm mb-4">
        Find local businesses by keyword and enrich their contact data
      </p>

      {/* Search Inputs */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Chiropractors, Dentists, Bakeries"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-foreground-secondary/50 focus:outline-none focus:border-accent-gold transition-colors text-sm"
            disabled={loading}
          />
          <input
            type="text"
            placeholder="e.g. Boston, MA"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-28 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-foreground-secondary/50 focus:outline-none focus:border-accent-gold transition-colors text-sm"
            disabled={loading}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-foreground-secondary whitespace-nowrap">Max results:</label>
          <select
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-accent-gold"
            disabled={loading}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim() || !location.trim()}
            className="ml-auto bg-gradient-to-r from-accent-gold to-accent-gold-light hover:from-accent-gold-light hover:to-accent-gold text-black font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:shadow-xl hover:shadow-accent-gold/40 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Searching...' : '🔍 Search'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-foreground-secondary">
            <span>
              Found <strong className="text-white">{results.total}</strong> leads
              {results.enriched > 0 && (
                <span> — <strong className="text-emerald-400">{results.enriched}</strong> enriched</span>
              )}
              {' '}(source: {results.source})
            </span>
            {results.leads.length > 0 && (
              <button onClick={toggleAll} className="text-accent-neon-blue hover:underline">
                {selectedLeadIds.size === results.leads.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>

          {/* Table */}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background-secondary">
                <tr className="text-foreground-secondary text-xs uppercase tracking-wider">
                  <th className="p-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={results.leads.length > 0 && selectedLeadIds.size === results.leads.length}
                      onChange={toggleAll}
                      className="accent-accent-gold"
                    />
                  </th>
                  <th className="p-2 text-left">Company</th>
                  <th className="p-2 text-left hidden sm:table-cell">Website</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left hidden md:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                      selectedLeadIds.has(lead.id) ? 'bg-accent-gold/5' : ''
                    }`}
                    onClick={() => toggleLead(lead.id)}
                  >
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.has(lead.id)}
                        onChange={() => toggleLead(lead.id)}
                        className="accent-accent-gold"
                      />
                    </td>
                    <td className="p-2 text-white font-medium">{lead.companyName}</td>
                    <td className="p-2 text-foreground-secondary text-xs hidden sm:table-cell truncate max-w-[120px]">
                      {lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-accent-neon-blue transition-colors"
                        >
                          {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`p-2 text-xs ${lead.email ? 'text-emerald-400' : 'text-foreground-secondary'}`}>
                      {lead.email || '—'}
                    </td>
                    <td className={`p-2 text-xs capitalize hidden md:table-cell ${statusColor(lead.status)}`}>
                      {lead.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Push to Mailer */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-foreground-secondary">
              {selectedLeadIds.size} lead{selectedLeadIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handlePushToMailer}
              disabled={selectedLeadIds.size === 0 || pushing}
              className="bg-gradient-to-r from-accent-neon-blue to-accent-gold hover:from-accent-gold hover:to-accent-neon-blue text-black font-bold py-1.5 px-4 rounded-lg transition-all duration-200 hover:shadow-xl hover:shadow-accent-neon-blue/40 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            >
              {pushing ? 'Pushing...' : '📨 Push to Mailer'}
            </button>
          </div>

          {/* Push result */}
          {pushResult && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
              ✅ {pushResult.inserted} recipient{pushResult.inserted !== 1 ? 's' : ''} added
              {pushResult.skipped > 0 && ` (${pushResult.skipped} skipped)`}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!results && !loading && !error && (
        <div className="text-center py-8 border border-dashed border-white/10 rounded-lg">
          <div className="text-3xl mb-2">🔎</div>
          <p className="text-foreground-secondary text-sm">Enter a business type and location to start scraping</p>
          <p className="text-foreground-secondary text-xs mt-1">1 credit per email enriched</p>
        </div>
      )}
    </div>
  );
}