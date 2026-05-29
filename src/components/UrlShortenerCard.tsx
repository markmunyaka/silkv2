'use client';

import { useState, useEffect, useCallback } from 'react';

interface ShortenedLink {
  id: string;
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  title: string | null;
  clicks: number;
  isActive: boolean;
  expiresAt: string | null;
  lastClickedAt: string | null;
  createdAt: string;
}

type SortField = 'createdAt' | 'clicks' | 'originalUrl';
type SortDir = 'asc' | 'desc';

export function UrlShortenerCard({ userId }: { userId: string }) {
  const [url, setUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [shortening, setShortening] = useState(false);
  const [result, setResult] = useState<ShortenedLink | null>(null);
  const [links, setLinks] = useState<ShortenedLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Edit modal
  const [editLink, setEditLink] = useState<ShortenedLink | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Analytics
  const [analyticsLink, setAnalyticsLink] = useState<ShortenedLink | null>(null);

  // Fetch user's links on mount
  const fetchLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const res = await fetch(`/api/url/my-links?userId=${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (json.ok) {
        setLinks(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch links', e);
    } finally {
      setLoadingLinks(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // ── Sorting & Filtering ─────────────────────────────────────────
  const sortedLinks = [...links]
    .filter((link) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        link.shortUrl.toLowerCase().includes(q) ||
        link.originalUrl.toLowerCase().includes(q) ||
        (link.title || '').toLowerCase().includes(q) ||
        link.shortCode.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'clicks') {
        cmp = a.clicks - b.clicks;
      } else {
        cmp = a.originalUrl.localeCompare(b.originalUrl);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // ── Shorten ─────────────────────────────────────────────────────
  const handleShorten = async () => {
    setError('');
    setResult(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter a URL');
      return;
    }

    let finalUrl = trimmed;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    const body: Record<string, any> = { url: finalUrl, userId };
    if (customCode.trim()) body.customCode = customCode.trim();
    if (title.trim()) body.title = title.trim();
    if (expiresAt.trim()) body.expiresAt = new Date(expiresAt.trim()).toISOString();

    setShortening(true);
    try {
      const res = await fetch('/api/url/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || 'Failed to shorten URL');
      }
      setResult(json.data);
      setUrl('');
      setCustomCode('');
      setTitle('');
      setExpiresAt('');
      setShowOptions(false);
      fetchLinks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setShortening(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !shortening) {
      handleShorten();
    }
  };

  // ── Copy ────────────────────────────────────────────────────────
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(id);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedIndex(id);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────
  const openEdit = (link: ShortenedLink) => {
    setEditLink(link);
    setEditUrl(link.originalUrl);
    setEditCode(link.shortCode);
    setEditTitle(link.title || '');
    setEditExpiresAt(link.expiresAt ? link.expiresAt.slice(0, 16) : '');
    setEditError('');
  };

  const handleEditSave = async () => {
    if (!editLink) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const body: Record<string, any> = {};
      if (editUrl.trim() && editUrl.trim() !== editLink.originalUrl) body.originalUrl = editUrl.trim();
      if (editCode.trim() && editCode.trim() !== editLink.shortCode) body.shortCode = editCode.trim();
      if (editTitle.trim() !== (editLink.title || '')) body.title = editTitle.trim() || null;
      const newExpiry = editExpiresAt.trim() ? new Date(editExpiresAt.trim()).toISOString() : null;
      const oldExpiry = editLink.expiresAt || null;
      if (newExpiry !== oldExpiry) body.expiresAt = newExpiry;

      const res = await fetch(`/api/url/${editLink.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to update');
      setEditLink(null);
      fetchLinks();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Toggle active ───────────────────────────────────────────────
  const toggleActive = async (link: ShortenedLink) => {
    try {
      const res = await fetch(`/api/url/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !link.isActive } as any),
      });
      const json = await res.json();
      if (json.ok) fetchLinks();
    } catch {
      // ignore
    }
  };

  // ── Delete ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/url/${deleteId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to delete');
      setDeleteId(null);
      fetchLinks();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  // ── QR code URL ─────────────────────────────────────────────────
  const qrUrl = (shortUrl: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shortUrl)}`;

  const truncateUrl = (u: string, maxLen = 50) =>
    u.length > maxLen ? u.slice(0, maxLen) + '…' : u;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isExpired = (link: ShortenedLink) =>
    link.expiresAt && new Date(link.expiresAt) < new Date();

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Shortener Card ──────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🔗</span>
          <h3 className="text-lg font-serif text-white">URL Shortener</h3>
        </div>
        <p className="text-sm text-foreground-secondary mb-5">
          Paste a long URL and get a short, shareable link instantly.
        </p>

        {/* Input Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com/very/long/url/here"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white text-sm placeholder:text-foreground-secondary/50 focus:border-accent-gold focus:outline-none transition-colors"
            disabled={shortening}
          />
          <button
            onClick={handleShorten}
            disabled={shortening || !url.trim()}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
          >
            {shortening ? 'Shortening…' : 'Shorten'}
          </button>
        </div>

        {/* Custom options toggle */}
        <button
          type="button"
          onClick={() => setShowOptions(!showOptions)}
          className="mt-3 text-xs text-foreground-secondary hover:text-accent-gold transition-colors flex items-center gap-1"
        >
          <span>{showOptions ? '▲' : '▼'}</span>
          <span>{showOptions ? 'Hide' : 'Show'} advanced options</span>
        </button>

        {/* Advanced options */}
        {showOptions && (
          <div className="mt-4 space-y-3 p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <div>
              <label className="block text-xs text-foreground-secondary mb-1">Custom alias (optional)</label>
              <div className="flex items-center gap-1 text-sm text-foreground-secondary">
                <span>{process.env.NEXT_PUBLIC_BASE_URL || window.location.origin}/s/</span>
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="my-custom-link"
                  maxLength={16}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white text-sm placeholder:text-foreground-secondary/50 focus:border-accent-gold focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-foreground-secondary mt-1">3–16 alphanumeric characters, hyphens and underscores allowed</p>
            </div>
            <div>
              <label className="block text-xs text-foreground-secondary mb-1">Title (optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My awesome link"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white text-sm placeholder:text-foreground-secondary/50 focus:border-accent-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-foreground-secondary mb-1">Expires at (optional)</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white text-sm focus:border-accent-gold focus:outline-none [color-scheme:dark]"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 mt-3">{error}</p>
        )}

        {/* Result */}
        {result && (
          <div className="mt-5 p-4 rounded-lg bg-accent-gold/5 border border-accent-gold/20">
            <p className="text-xs text-foreground-secondary mb-1">Your shortened URL:</p>
            <div className="flex items-center gap-2">
              <a
                href={result.shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-gold hover:underline font-medium text-sm truncate"
              >
                {result.shortUrl}
              </a>
              <button
                onClick={() => copyToClipboard(result.shortUrl, 'result')}
                className={`shrink-0 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  copiedIndex === 'result'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/10 text-foreground-secondary border border-white/10 hover:text-white hover:bg-white/15'
                }`}
              >
                {copiedIndex === 'result' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-foreground-secondary mt-2 truncate">
              → {result.originalUrl}
            </p>
          </div>
        )}
      </div>

      {/* ── Clicks Overview ──────────────────────────────────────── */}
      {!loadingLinks && links.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📊</span>
            <h3 className="text-lg font-serif text-white">Clicks Overview</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-accent-gold/5 border border-accent-gold/20 text-center">
              <p className="text-2xl font-bold text-accent-gold">
                {links.reduce((sum, l) => sum + l.clicks, 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-foreground-secondary mt-1">Total Clicks</p>
            </div>
            <div className="p-4 rounded-lg bg-accent-neon-blue/5 border border-accent-neon-blue/20 text-center">
              <p className="text-2xl font-bold text-accent-neon-blue">
                {links.filter((l) => l.lastClickedAt).length}
              </p>
              <p className="text-[10px] text-foreground-secondary mt-1">Links Clicked</p>
            </div>
            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
              <p className="text-2xl font-bold text-emerald-400">
                {links.filter((l) => l.clicks > 0).length} / {links.length}
              </p>
              <p className="text-[10px] text-foreground-secondary mt-1">Links with Activity</p>
            </div>
          </div>
          {/* Top performers */}
          {links.filter((l) => l.clicks > 0).length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-foreground-secondary mb-2">🏆 Top performer:</p>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                {(() => {
                  const top = [...links].sort((a, b) => b.clicks - a.clicks)[0];
                  return (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-accent-gold font-medium text-sm truncate">
                          /s/{top.shortCode}
                        </span>
                        {top.title && (
                          <span className="text-xs text-foreground-secondary truncate hidden sm:inline">
                            — {top.title}
                          </span>
                        )}
                      </div>
                      <span className="text-accent-gold font-bold shrink-0">{top.clicks} click{top.clicks !== 1 ? 's' : ''}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Link History ────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h3 className="text-lg font-serif text-white">Your Links</h3>
            {!loadingLinks && (
              <span className="text-xs text-foreground-secondary bg-white/5 px-2 py-0.5 rounded-full">
                {sortedLinks.length}
              </span>
            )}
          </div>
        </div>

        {/* Search & Sort */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search links…"
            className="flex-1 min-w-[160px] rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white text-xs placeholder:text-foreground-secondary/50 focus:border-accent-gold focus:outline-none"
          />
          <div className="flex items-center gap-1">
            {(['createdAt', 'clicks', 'originalUrl'] as const).map((field) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-all ${
                  sortField === field
                    ? 'bg-accent-gold/10 border-accent-gold/30 text-accent-gold'
                    : 'border-white/10 text-foreground-secondary hover:text-white'
                }`}
              >
                {field === 'createdAt' ? 'Date' : field === 'clicks' ? 'Clicks' : 'URL'}
                {sortField === field && (sortDir === 'asc' ? ' ▲' : ' ▼')}
              </button>
            ))}
          </div>
        </div>

        {loadingLinks ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
            <p className="text-foreground-secondary text-xs mt-2">Loading links…</p>
          </div>
        ) : sortedLinks.length === 0 ? (
          <div className="text-center py-8 rounded-lg border border-dashed border-white/10">
            <span className="text-3xl block mb-2">
              {searchQuery ? '🔍' : '🔗'}
            </span>
            <p className="text-foreground-secondary text-sm">
              {searchQuery ? 'No links match your search.' : 'No links yet. Shorten your first URL above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedLinks.map((link) => {
              const expired = isExpired(link);
              return (
                <div
                  key={link.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all group ${
                    !link.isActive || expired
                      ? 'bg-white/[0.01] border-white/[0.04] opacity-60'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                  }`}
                >
                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status indicator */}
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          expired
                            ? 'bg-red-500'
                            : !link.isActive
                            ? 'bg-yellow-500'
                            : 'bg-emerald-500'
                        }`}
                        title={
                          expired
                            ? 'Expired'
                            : !link.isActive
                            ? 'Disabled'
                            : 'Active'
                        }
                      />
                      {link.title && (
                        <span className="text-xs text-white font-medium truncate max-w-[120px]">
                          {link.title}
                        </span>
                      )}
                      <a
                        href={link.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-gold hover:underline text-sm font-medium truncate"
                      >
                        /s/{link.shortCode}
                      </a>
                      <button
                        onClick={() => copyToClipboard(link.shortUrl, link.id)}
                        className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium transition-all opacity-0 group-hover:opacity-100 ${
                          copiedIndex === link.id
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/10 text-foreground-secondary hover:text-white'
                        }`}
                      >
                        {copiedIndex === link.id ? 'Copied!' : 'Copy'}
                      </button>
                      {/* QR */}
                      <a
                        href={qrUrl(link.shortUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 text-xs text-foreground-secondary hover:text-white transition-all"
                        title="View QR code"
                      >
                        📱
                      </a>
                    </div>
                    <p className="text-xs text-foreground-secondary truncate mt-0.5">
                      {truncateUrl(link.originalUrl, 60)}
                    </p>
                    {link.expiresAt && (
                      <p className={`text-[10px] mt-0.5 ${expired ? 'text-red-400' : 'text-foreground-secondary'}`}>
                        {expired ? 'Expired:' : 'Expires:'} {formatDate(link.expiresAt)}
                      </p>
                    )}
                  </div>

                  {/* Clicks & Date */}
                  <div className="shrink-0 flex items-center gap-3 text-xs text-foreground-secondary">
                    <span className="flex items-center gap-1" title="Total clicks">
                      <span>👁</span>
                      <span>{link.clicks}</span>
                    </span>
                    <span className="hidden sm:inline text-[10px]">{formatDate(link.createdAt)}</span>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {/* Toggle active */}
                    <button
                      onClick={() => toggleActive(link)}
                      title={link.isActive ? 'Disable' : 'Enable'}
                      className="p-1.5 rounded text-[11px] text-foreground-secondary hover:text-white hover:bg-white/10 transition-all"
                    >
                      {link.isActive ? '⏸' : '▶️'}
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => openEdit(link)}
                      title="Edit"
                      className="p-1.5 rounded text-[11px] text-foreground-secondary hover:text-accent-gold hover:bg-white/10 transition-all"
                    >
                      ✏️
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => setDeleteId(link.id)}
                      title="Delete"
                      className="p-1.5 rounded text-[11px] text-foreground-secondary hover:text-red-400 hover:bg-white/10 transition-all"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Edit Modal ──────────────────────────────────────────── */}
      {editLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="rounded-2xl border border-white/[0.08] bg-black/90 backdrop-blur-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-serif text-white mb-4">✏️ Edit Link</h3>

            {editError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                {editError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Destination URL</label>
                <input
                  type="url"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:border-accent-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Short code</label>
                <div className="flex items-center gap-1 text-sm text-foreground-secondary">
                  <span>/s/</span>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    maxLength={16}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:border-accent-gold focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:border-accent-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-foreground-secondary mb-1">Expires at (optional)</label>
                <input
                  type="datetime-local"
                  value={editExpiresAt}
                  onChange={(e) => setEditExpiresAt(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:border-accent-gold focus:outline-none [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setEditLink(null); setEditError(''); }}
                disabled={savingEdit}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white font-medium hover:bg-white/15 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={savingEdit}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg disabled:opacity-50"
              >
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ───────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="rounded-2xl border border-white/[0.08] bg-black/90 backdrop-blur-xl p-6 w-full max-w-sm text-center">
            <span className="text-3xl block mb-3">🗑️</span>
            <h3 className="text-lg font-serif text-white mb-2">Delete Link?</h3>
            <p className="text-sm text-foreground-secondary mb-6">
              This action cannot be undone. The short URL will stop working immediately.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white font-medium hover:bg-white/15 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}