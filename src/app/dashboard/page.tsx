'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DomainSearchCard from '@/components/DomainSearchCard';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import DragDropUpload from '@/components/DragDropUpload';
import PDFConverter from '@/components/PDFConverter';
import PDFDataExtractor from '@/components/PDFDataExtractor';
import LeadScraperCard from '@/components/LeadScraperCard';
import LeadValidationCard from '@/components/LeadValidationCard';
import VideoGenerationCard from '@/components/VideoGenerationCard';
import TLOverificationCard from '@/components/TLOverificationCard';
import SilkProMailer from '@/components/mailer/gammadyne/SilkProMailer';
import SmtpStorefront from '@/components/mailer/SmtpStorefront';
import WalletCard from '@/components/mailer/WalletCard';
import DepositCard from '@/components/DepositCard';
import ReferralCard from '@/components/ReferralCard';
import TransactionHistory from '@/components/wallet/TransactionHistory';
import { UrlShortenerCard } from '@/components/UrlShortenerCard';
import { EmailBomberCard } from '@/components/EmailBomberCard';
import RdpStoreCard from '@/components/RdpStoreCard';
import CpanelStoreCard from '@/components/CpanelStoreCard';

interface SummaryItem {
  summaryText?: string;
  id: string;
  fileName: string;
  date: string;
  wordCount: number;
  summaryLength: number;
  audioUrl?: string;
  videoUrl?: string;
  videoStatus?: 'idle' | 'queued' | 'processing' | 'succeeded' | 'failed';
  videoError?: string;
}

type VideoGenState = {
  summaryId: string;
  summaryText: string;
  status: 'idle' | 'queued' | 'processing' | 'succeeded' | 'failed';
  taskId: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
};

type SidebarSection = 'overview' | 'verification' | 'leads' | 'mailer' | 'smtp-store' | 'wallet' | 'documents' | 'settings' | 'links' | 'bomber' | 'rdp-store' | 'cpanel-store';

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFile, setProcessingFile] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string>('');
  const [activeSection, setActiveSection] = useState<SidebarSection>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [videoGenStates, setVideoGenStates] = useState<Record<string, VideoGenState>>({});
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Wallet tab state
  const [walletTab, setWalletTab] = useState<'balance' | 'deposit' | 'history'>('balance');
  const [walletBalance, setWalletBalance] = useState(0);

  // Load wallet USD balance from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('wallet_usd_balance');
    if (stored) setWalletBalance(parseFloat(stored));
    
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'number') setWalletBalance(detail);
    };
    window.addEventListener('wallet-balance-update', handler);
    return () => window.removeEventListener('wallet-balance-update', handler);
  }, []);

  // Listen for redirect-to-deposit events from store purchase modals
  useEffect(() => {
    const handleRedirectToDeposit = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log('[Deposit Redirect]', detail);
      setActiveSection('wallet');
      setWalletTab('deposit');
    };
    window.addEventListener('redirect-to-deposit', handleRedirectToDeposit);
    return () => {
      window.removeEventListener('redirect-to-deposit', handleRedirectToDeposit);
      Object.values(pollRefs.current).forEach(clearInterval);
    };
  }, []);

  const stopPolling = useCallback((summaryId: string) => {
    if (pollRefs.current[summaryId]) { clearInterval(pollRefs.current[summaryId]); delete pollRefs.current[summaryId]; }
  }, []);

  const pollSummaryVideoStatus = useCallback(async (summaryId: string, taskId: string) => {
    try {
      const res = await fetch(`/api/video/status?taskId=${encodeURIComponent(taskId)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Polling failed');
      const { status, videoUrl, thumbnailUrl, errorMessage } = json.data;
      if (status === 'SUCCEEDED') {
        setVideoGenStates((prev) => ({ ...prev, [summaryId]: { ...prev[summaryId], status: 'succeeded', videoUrl: videoUrl ?? null, thumbnailUrl: thumbnailUrl ?? null } }));
        setSummaries((s) => s.map((item) => item.id === summaryId ? { ...item, videoUrl: videoUrl ?? undefined, videoStatus: 'succeeded' } : item));
        stopPolling(summaryId);
      } else if (status === 'FAILED') {
        setVideoGenStates((prev) => ({ ...prev, [summaryId]: { ...prev[summaryId], status: 'failed', error: errorMessage || 'Video generation failed' } }));
        setSummaries((s) => s.map((item) => item.id === summaryId ? { ...item, videoStatus: 'failed', videoError: errorMessage } : item));
        stopPolling(summaryId);
      } else {
        setVideoGenStates((prev) => ({ ...prev, [summaryId]: { ...prev[summaryId], status: 'processing' } }));
        setSummaries((s) => s.map((item) => item.id === summaryId ? { ...item, videoStatus: 'processing' } : item));
      }
    } catch (e) { console.warn(`[Poll] Summary ${summaryId} poll error:`, e); }
  }, [stopPolling]);

  const handleGenerateVideoSummary = useCallback(async (summaryId: string, summaryText: string) => {
    if (!summaryText || !user?.id) return;
    setVideoGenStates((prev) => ({ ...prev, [summaryId]: { summaryId, summaryText, status: 'idle', taskId: null, videoUrl: null, thumbnailUrl: null, error: null } }));
    setSummaries((s) => s.map((item) => (item.id === summaryId ? { ...item, videoStatus: 'queued' } : item)));
    try {
      const res = await fetch('/api/video/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: summaryText.slice(0, 2000), workspaceId: user.id, duration: 5, aspect_ratio: '16:9' }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to queue');
      const taskId = json.data.taskId;
      setVideoGenStates((prev) => ({ ...prev, [summaryId]: { ...prev[summaryId], taskId, status: 'queued' } }));
      pollRefs.current[summaryId] = setInterval(() => pollSummaryVideoStatus(summaryId, taskId), 6_000);
      await pollSummaryVideoStatus(summaryId, taskId);
    } catch (e) {
      setVideoGenStates((prev) => ({ ...prev, [summaryId]: { ...prev[summaryId], status: 'failed', error: (e as Error).message } }));
      setSummaries((s) => s.map((item) => item.id === summaryId ? { ...item, videoStatus: 'failed', videoError: (e as Error).message } : item));
    }
  }, [user, pollSummaryVideoStatus]);

  const handleFileSelect = async (file: File) => {
    setUploadError('');
    setProcessingFile(file.name); setIsProcessing(true); setProcessingProgress(0);
    const progressInterval = setInterval(() => { setProcessingProgress((p) => Math.min(95, p + Math.floor(Math.random() * 10) + 5)); }, 600);
    try {
      const formData = new FormData(); formData.append('pdf', file); formData.append('userId', user?.id || '');
      const response = await fetch('/api/summarize', { method: 'POST', body: formData });
      if (!response.ok) { clearInterval(progressInterval); const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Failed'); }
      const result = await response.json();
      clearInterval(progressInterval); setProcessingProgress(100);
      setSummaries((s) => [{ id: Date.now().toString(), fileName: file.name, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), wordCount: result.textLength ?? 0, summaryLength: (result.summary || '').split(' ').filter(Boolean).length, summaryText: result.summary || '', videoStatus: 'idle' }, ...s]);
      setIsProcessing(false); setProcessingFile(''); setProcessingProgress(0);
    } catch (error: any) {
      clearInterval(progressInterval); setUploadError(error?.message || 'Failed'); setIsProcessing(false); setProcessingFile(''); setProcessingProgress(0);
    }
  };

  // ─── Sidebar Items ──────────────────────────────────────────────────
  const sidebarItems: { id: SidebarSection; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'verification', label: 'Verification', icon: '🛡️' },
    { id: 'leads', label: 'Leads & Web', icon: '🎯' },
    { id: 'mailer', label: 'Silk Mailer', icon: '📧' },
    { id: 'smtp-store', label: 'SMTP Store', icon: '🏪' },
    { id: 'wallet', label: 'Wallet', icon: '💎' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'links', label: 'URL Shortener', icon: '🔗' },
    { id: 'rdp-store', label: 'RDP Store', icon: '🖥️' },
    { id: 'cpanel-store', label: 'cPanel Store', icon: '🌐' },
    { id: 'bomber', label: 'Email Bomber', icon: '💣' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  // ─── Sidebar ────────────────────────────────────────────────────────
  const sidebar = (
    <aside className={`fixed left-0 top-0 h-full z-40 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-56'}`}>
      <div className="h-full backdrop-blur-xl bg-black/80 border-r border-white/[0.06] flex flex-col">
        <div className={`flex items-center h-16 px-4 border-b border-white/[0.06] ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
          {sidebarCollapsed ? (
            <span className="text-xl font-serif text-accent-gold">S</span>
          ) : (
            <><span className="text-xl font-serif text-accent-gold">Silk Road V2</span></>
          )}
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2">
          {sidebarItems.map((item) => (
            <button key={item.id} onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeSection === item.id ? 'bg-accent-gold/10 text-accent-gold border border-accent-gold/20' : 'text-foreground-secondary hover:text-white hover:bg-white/5 border border-transparent'} ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={sidebarCollapsed ? item.label : undefined}>
              <span className="text-base">{item.icon}</span>
              {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
              {activeSection === item.id && !sidebarCollapsed && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-gold" />}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-white/[0.06]">
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-foreground-secondary hover:text-white transition-colors">
            {sidebarCollapsed ? '→' : '◄ Collapse'}
          </button>
        </div>
      </div>
    </aside>
  );

  // ─── Top Bar ────────────────────────────────────────────────────────
  const topBar = (
    <header className={`fixed top-0 right-0 h-16 z-30 backdrop-blur-xl bg-black/60 border-b border-white/[0.06] transition-all duration-300 ${sidebarCollapsed ? 'left-16' : 'left-56'}`}>
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-foreground-secondary">Dashboard</span>
          <span className="text-foreground-secondary">/</span>
          <span className="text-white font-medium capitalize">
            {activeSection === 'mailer' ? 'Silk Mailer' : activeSection === 'smtp-store' ? 'SMTP Store' : activeSection === 'wallet' ? 'Wallet' : activeSection === 'links' ? 'URL Shortener' : activeSection === 'bomber' ? 'Email Bomber' : activeSection === 'rdp-store' ? 'RDP Store' : activeSection === 'cpanel-store' ? 'cPanel Store' : activeSection}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-white font-medium">{user?.name || 'User'}</p>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-sm font-bold text-black">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );

  // ─── Overview ───────────────────────────────────────────────────────
  const OverviewSection = () => (
    <div className="space-y-8 animate-fade-in relative min-h-screen p-6 rounded-2xl overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-2xl"
        style={{ backgroundImage: "url('/overview-bg.jpg')" }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/60 rounded-2xl" />

      <div className="relative z-10 space-y-8">
        {/* Telegram Announcement Banner */}
        <a
          href="https://t.me/+4TTUyqM-tyc1MWE0"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-2xl border-2 border-[#0088cc]/40 bg-gradient-to-r from-[#0088cc]/30 via-[#0088cc]/15 to-[#0088cc]/5 p-8 hover:from-[#0088cc]/40 hover:to-[#0088cc]/15 hover:border-[#0088cc]/60 transition-all group cursor-pointer shadow-lg shadow-[#0088cc]/10"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="relative">
                <span className="text-5xl">✈️</span>
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-white">Join our Telegram Channel</p>
                <p className="text-sm sm:text-base text-foreground-secondary mt-1">Get updates, tips & exclusive content</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold">Active Community</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="px-5 py-2.5 rounded-lg bg-[#0088cc] text-white font-bold text-sm hover:bg-[#0088cc]/80 transition-all group-hover:shadow-lg group-hover:shadow-[#0088cc]/30">
                Join Now ✈️
              </span>
              <span className="text-2xl text-accent-gold group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </a>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Documents', value: summaries.length, icon: '📄', color: 'from-accent-gold/20 to-accent-gold/5' },
            { label: 'Summaries', value: summaries.length, icon: '📝', color: 'from-accent-neon-blue/20 to-accent-neon-blue/5' },
            { label: 'Verifications', value: '0', icon: '🛡️', color: 'from-purple-500/20 to-purple-500/5' },
            { label: 'Leads Scraped', value: '0', icon: '🎯', color: 'from-emerald-500/20 to-emerald-500/5' },
          ].map((stat) => (
            <div key={stat.label} className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br ${stat.color} p-5`}>
              <div className="flex items-center justify-between">
                <div><p className="text-2xl font-bold text-white">{stat.value}</p><p className="text-xs text-foreground-secondary mt-1">{stat.label}</p></div>
                <span className="text-2xl opacity-60">{stat.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Announcements */}
        <div className="space-y-6">
          <h3 className="text-xl font-serif text-white flex items-center gap-2">
            <span>📢</span> Announcements
          </h3>
          <div className="rounded-2xl border border-white/[0.10] bg-gradient-to-r from-accent-gold/15 via-accent-neon-blue/10 to-accent-gold/5 p-8 shadow-lg shadow-accent-gold/5">
            <div className="flex items-start gap-6">
              <div className="relative w-16 h-20 mt-1 shrink-0">
                {/* Outer glow */}
                <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,100,0,0.4) 0%, transparent 70%)', animation: 'flame-glow 1.2s ease-in-out infinite' }} />
                {/* Main flame body */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-16 rounded-full" style={{ background: 'linear-gradient(180deg, #ff4400 0%, #ff8800 40%, #ffcc00 70%, #ffee88 100%)', borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', filter: 'blur(1px)', animation: 'flame-body 0.6s ease-in-out infinite' }} />
                {/* Inner bright core */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-5 h-10 rounded-full" style={{ background: 'linear-gradient(180deg, #ffaa00 0%, #ffee88 60%, #ffffff 100%)', borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', filter: 'blur(0.5px)', animation: 'flame-core 0.8s ease-in-out infinite' }} />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-white mb-2">Logs & Enrolls Coming Soon!</p>
                <p className="text-base text-foreground-secondary leading-relaxed">
                  We will be selling logs and enrolls very soon. Stay tuned for updates and exclusive early access.
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <span className="inline-block w-3 h-3 rounded-full bg-accent-gold animate-pulse" />
                  <span className="text-sm uppercase tracking-widest text-accent-gold font-bold">New</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  // ─── Verification ───────────────────────────────────────────────────
  const VerificationSection = () => (
    <div className="space-y-8 animate-fade-in relative min-h-[300px] p-6 rounded-2xl overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-2xl"
        style={{ backgroundImage: "url('/verification-bg.jpg')" }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/60 rounded-2xl" />

      <div className="relative z-10">
        <div className="mb-6">
          <h2 className="text-2xl font-serif text-white">Identity Verification</h2>
          <p className="text-foreground-secondary text-sm mt-1">TransUnion TLOxp — SSN lookup, phone trace, background checks & email validation</p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <TLOverificationCard />
          <LeadValidationCard />
        </div>
      </div>
    </div>
  );

  // ─── Leads & Web ────────────────────────────────────────────────────
  const LeadsSection = () => (
    <div className="space-y-8 animate-fade-in relative min-h-[300px] p-6 rounded-2xl overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-2xl"
        style={{ backgroundImage: "url('/overview-bg.jpg')" }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/60 rounded-2xl" />

      <div className="relative z-10">
        <div className="mb-6">
          <h2 className="text-2xl font-serif text-white">Lead Generation & Web Tools</h2>
          <p className="text-foreground-secondary text-sm mt-1">Scrape B2B leads, search domains, and generate AI video content</p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2"><LeadScraperCard /></div>
          <DomainSearchCard />
        </div>
        <div className="mt-6"><VideoGenerationCard /></div>
      </div>
    </div>
  );

  // ─── Silk Mailer (Gammadyne Pro) ─────────────────────────────────────
  const MailerSection = () => (
    <div className="animate-fade-in">
      <SilkProMailer />
    </div>
  );

  // ─── SMTP Store ──────────────────────────────────────────────────────
  const SmtpStoreSection = () => (
    <div className="animate-fade-in relative min-h-[300px] p-6 rounded-2xl overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-2xl"
        style={{ backgroundImage: "url('/smtp-store-bg.jpg')" }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/60 rounded-2xl" />

      <div className="relative z-10">
        <div className="mb-6">
          <h2 className="text-2xl font-serif text-white">SMTP Provider Store</h2>
          <p className="text-foreground-secondary text-sm mt-1">Browse and purchase SMTP relay providers for your email campaigns</p>
        </div>
        <SmtpStorefront />
      </div>
    </div>
  );

  // ─── Wallet (Balance + Deposit tabs) ─────────────────────────────────
  const WalletSection = () => (
    <div className="animate-fade-in relative min-h-[300px] p-6 rounded-2xl overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-2xl"
        style={{ backgroundImage: "url('/wallet-bg.jpg')" }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/60 rounded-2xl" />

      <div className="relative z-10">
        <div className="mb-6">
          <h2 className="text-2xl font-serif text-white">💎 Wallet</h2>
          <p className="text-foreground-secondary text-sm mt-1">Check your balance, view transactions, and deposit funds</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1.5 mb-6 bg-white/5 rounded-lg p-1 w-fit">
          {([
            { id: 'balance' as const, label: 'Balance', icon: '💰' },
            { id: 'deposit' as const, label: 'Deposit', icon: '📥' },
            { id: 'history' as const, label: 'History', icon: '📋' },
          ]).map((tab) => (
            <button key={tab.id} onClick={() => setWalletTab(tab.id)}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-md text-sm font-medium transition-all ${
                walletTab === tab.id
                  ? 'bg-accent-gold text-black shadow-lg shadow-accent-gold/30'
                  : 'text-foreground-secondary hover:text-white'
              }`}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {walletTab === 'balance' && (
          <div className="space-y-6">
            {/* Balance Card — shows USD value */}
            <div className="glass-lg rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">💰</span>
                <h3 className="text-lg font-serif text-white">Account Balance</h3>
              </div>
              <p className="text-foreground-secondary text-sm mb-5">Your available balance for services</p>

              <div className="text-center py-4">
                <p className="text-5xl font-serif font-bold text-white mb-2">
                  $<span className="tabular-nums">{walletBalance.toFixed(2)}</span>
                </p>
                <p className="text-slate-400 text-sm">Available Balance</p>
              </div>

              {/* Quick breakdown */}
              <div className="grid grid-cols-1 gap-3 mt-5 max-w-sm mx-auto">
                <div className="p-3 rounded-lg bg-accent-gold/5 border border-accent-gold/20 text-center">
                  <p className="text-lg font-bold text-accent-gold">${walletBalance.toFixed(2)}</p>
                  <p className="text-[10px] text-foreground-secondary mt-0.5">USD Balance</p>
                </div>
              </div>
            </div>

            {/* Referrals */}
            <div className="max-w-lg">
              <ReferralCard />
            </div>
          </div>
        )}

        {walletTab === 'deposit' && (
          <div className="space-y-6">
            <DepositCard />
          </div>
        )}

        {walletTab === 'history' && (
          <div className="space-y-6">
            <TransactionHistory />
          </div>
        )}
      </div>
    </div>
  );

  // ─── Documents ──────────────────────────────────────────────────────
  const DocumentsSection = () => (
    <div className="animate-fade-in relative min-h-[300px] p-6 rounded-2xl overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-2xl"
        style={{ backgroundImage: "url('/documents-bg.jpg')" }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/60 rounded-2xl" />

      <div className="relative z-10">
        <div className="mb-6">
          <h2 className="text-2xl font-serif text-white">Document Processing</h2>
          <p className="text-foreground-secondary text-sm mt-1">Upload, summarize, convert and extract data from PDFs</p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-4"><span className="text-xl">📄</span><h3 className="text-lg font-serif text-white">Upload & Summarize</h3></div>
            <DragDropUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
            {uploadError && <p className="text-sm text-red-400 mt-3">{uploadError}</p>}
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-4"><span className="text-xl">🔄</span><h3 className="text-lg font-serif text-white">Format Converter</h3></div>
            {user && (
              <PDFConverter userId={user.id}
                onConversionComplete={(success, message) => { if (success) console.log('OK:', message); else console.error('Fail:', message); }} />
            )}
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-4"><span className="text-xl">🔍</span><h3 className="text-lg font-serif text-white">Data Extraction</h3></div>
            {user && <PDFDataExtractor userId={user.id} />}
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Settings State ──────────────────────────────────────────────────
  const [settingsTab, setSettingsTab] = useState<'profile' | 'password' | 'email' | '2fa' | 'sessions' | 'logout' | 'delete'>('profile');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ─── Settings ───────────────────────────────────────────────────────
  const SettingsSection = () => (
    <div className="animate-fade-in relative min-h-[300px] p-6 rounded-2xl overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-2xl"
        style={{ backgroundImage: "url('/settings-bg.jpg')" }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/60 rounded-2xl" />

      <div className="relative z-10">
        <div className="mb-6">
          <h2 className="text-2xl font-serif text-white">Account Settings</h2>
          <p className="text-foreground-secondary text-sm mt-1">Manage your account, security, and preferences</p>
        </div>

        {/* Settings Navigation */}
        <div className="flex gap-1.5 mb-6 bg-white/5 rounded-lg p-1 w-fit flex-wrap">
          {([
            { id: 'profile' as const, label: 'Profile', icon: '👤' },
            { id: 'password' as const, label: 'Password', icon: '🔑' },
            { id: 'email' as const, label: 'Email', icon: '📧' },
            { id: '2fa' as const, label: '2FA', icon: '🔐' },
            { id: 'sessions' as const, label: 'Sessions', icon: '🌐' },
            { id: 'logout' as const, label: 'Log Out', icon: '🚪' },
            { id: 'delete' as const, label: 'Delete', icon: '🗑️' },
          ]).map((tab) => (
            <button key={tab.id} onClick={() => setSettingsTab(tab.id)}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-md text-sm font-medium transition-all ${
                settingsTab === tab.id
                  ? 'bg-accent-gold text-black shadow-lg shadow-accent-gold/30'
                  : 'text-foreground-secondary hover:text-white'
              } ${
                tab.id === 'delete' && settingsTab !== 'delete' ? 'hover:text-red-400' : ''
              }`}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {settingsTab === 'profile' && (
          <div className="glass-lg rounded-xl p-6 max-w-2xl">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-2xl font-bold text-black">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-xl font-serif text-white">{user?.name || 'User'}</p>
                <p className="text-sm text-foreground-secondary">{user?.email || 'user@example.com'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Display Name</label>
                <input type="text" defaultValue={user?.name || ''} placeholder="Your name" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" />
              </div>
              <button className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg transition-all">Save Changes</button>
            </div>
          </div>
        )}

        {settingsTab === 'password' && <ChangePasswordForm />}
        {settingsTab === 'email' && <ChangeEmailForm currentEmail={user?.email || ''} />}
        {settingsTab === '2fa' && <TwoFactorForm />}
        {settingsTab === 'sessions' && <SessionsPanel />}

        {settingsTab === 'logout' && (
          <div className="glass-lg rounded-xl p-6 max-w-lg">
            <h3 className="text-lg font-serif text-white mb-4">🚪 Log Out</h3>
            <p className="text-sm text-slate-400 mb-6">You will be signed out and redirected to the login page.</p>
            <button
              onClick={() => { logout(); router.push('/auth/login'); }}
              className="w-full px-6 py-3 rounded-lg bg-white/10 border border-white/20 text-white font-medium hover:bg-white/15 transition-all"
            >
              Sign Out
            </button>
          </div>
        )}

        {settingsTab === 'delete' && (
          <div className="glass-lg rounded-xl p-6 max-w-lg">
            <h3 className="text-lg font-serif text-red-400 mb-2">🗑️ Delete Account</h3>
            <p className="text-sm text-slate-400 mb-6">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-6 py-3 rounded-lg bg-red-600/20 border border-red-600/40 text-red-400 font-medium hover:bg-red-600/30 transition-all"
              >
                Delete My Account
              </button>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-red-400 text-sm font-medium mb-1">⚠️ Are you absolutely sure?</p>
                  <p className="text-red-400/70 text-xs">
                    This will permanently delete your account, files, campaigns, and all related data.
                    You will not be able to recover anything.
                  </p>
                </div>

                {deleteError && (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-red-400 text-sm">{deleteError}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Type <span className="text-red-400 font-bold">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder='Type "DELETE" to confirm'
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-red-500 focus:outline-none"
                    disabled={deleting}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeleteError(''); }}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white font-medium hover:bg-white/15 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (deleteConfirmText !== 'DELETE') return;
                      setDeleteError('');
                      setDeleting(true);
                      try {
                        const res = await fetch('/api/auth/delete', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: user?.id }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Failed to delete account');
                        logout();
                        router.push('/auth/login');
                      } catch (err: any) {
                        setDeleteError(err.message || 'An error occurred');
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    disabled={deleteConfirmText !== 'DELETE' || deleting}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Deleting...' : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  /* ===== Change Password Form ===== */
  function ChangePasswordForm() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setMessage(null);

      if (!currentPassword) { setMessage({ type: 'error', text: 'Current password is required' }); return; }
      if (newPassword.length < 8) { setMessage({ type: 'error', text: 'New password must be at least 8 characters' }); return; }
      if (newPassword !== confirmPassword) { setMessage({ type: 'error', text: 'Passwords do not match' }); return; }

      setSaving(true);
      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Failed to change password');
        setMessage({ type: 'success', text: 'Password changed successfully' });
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message });
      }
      setSaving(false);
    };

    return (
      <div className="glass-lg rounded-xl p-6 max-w-lg">
        <h3 className="text-lg font-serif text-white mb-4">Change Password</h3>
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Current Password</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" required />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" required />
            <p className="text-xs text-slate-500 mt-1">Minimum 8 characters with uppercase, lowercase, and numbers</p>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" required />
          </div>
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg disabled:opacity-50 transition-all">
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    );
  }

  /* ===== Change Email Form ===== */
  function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
    const [newEmail, setNewEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setMessage(null);

      if (!newEmail.trim()) { setMessage({ type: 'error', text: 'New email is required' }); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { setMessage({ type: 'error', text: 'Please enter a valid email address' }); return; }
      if (!password) { setMessage({ type: 'error', text: 'Password is required to change email' }); return; }

      setSaving(true);
      try {
        const res = await fetch('/api/auth/change-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newEmail: newEmail.toLowerCase().trim(), password }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Failed to change email');
        setMessage({ type: 'success', text: 'Email changed successfully. A verification email has been sent.' });
        setNewEmail(''); setPassword('');
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message });
      }
      setSaving(false);
    };

    return (
      <div className="glass-lg rounded-xl p-6 max-w-lg">
        <h3 className="text-lg font-serif text-white mb-4">Change Email Address</h3>
        <p className="text-sm text-slate-400 mb-4">Current email: <span className="text-white">{currentEmail}</span></p>
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">New Email Address</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@example.com" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" required />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Confirm Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" required />
          </div>
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium hover:shadow-lg disabled:opacity-50 transition-all">
            {saving ? 'Updating...' : 'Update Email'}
          </button>
        </form>
      </div>
    );
  }

  /* ===== Two-Factor Authentication Form ===== */
  function TwoFactorForm() {
    const [enabled, setEnabled] = useState(twoFactorEnabled);
    const [method, setMethod] = useState<'app' | 'email' | 'sms' | null>(null);
    const [code, setCode] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleToggle = () => {
      setEnabled(!enabled);
      setTwoFactorEnabled(!enabled);
      setMethod(null);
      setMessage(enabled ? { type: 'success', text: '2FA disabled' } : { type: 'success', text: '2FA enabled. Choose your preferred method below.' });
      setTimeout(() => setMessage(null), 3000);
    };

    return (
      <div className="glass-lg rounded-xl p-6 max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-serif text-white">Two-Factor Authentication</h3>
            <p className="text-sm text-slate-400 mt-1">Add an extra layer of security to your account</p>
          </div>
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${enabled ? 'bg-accent-gold' : 'bg-white/10'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
            {message.text}
          </div>
        )}

        {enabled && (
          <>
            <div className="space-y-3 mb-6">
              {(['app', 'email', 'sms'] as const).map((m) => (
                <label key={m} className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${method === m ? 'border-accent-gold bg-accent-gold/5' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}`}>
                  <input type="radio" name="2fa-method" checked={method === m} onChange={() => setMethod(m)} className="accent-accent-gold" />
                  <span className="text-lg">
                    {m === 'app' ? '📱' : m === 'email' ? '📧' : '💬'}
                  </span>
                  <div>
                    <p className="text-sm text-white font-medium capitalize">{m === 'app' ? 'Authenticator App' : m === 'email' ? 'Email Codes' : 'SMS Codes'}</p>
                    <p className="text-xs text-slate-500">
                      {m === 'app' ? 'Use Google Authenticator, Authy, etc.' : m === 'email' ? 'Receive codes via email' : 'Receive codes via text message'}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {method && (
              <div className="space-y-3 p-4 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-slate-400">
                  {method === 'app' ? 'Enter the code from your authenticator app:' : `A verification code has been sent to your ${method === 'email' ? 'email' : 'phone'}:`}
                </p>
                <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="000000" maxLength={6} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white text-center text-2xl tracking-[0.5em] focus:border-accent-gold focus:outline-none" />
                <button disabled={code.length !== 6} className="px-6 py-2 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black font-medium disabled:opacity-50 transition-all">Verify & Enable</button>
              </div>
            )}
          </>
        )}

        {!enabled && (
          <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
            <p className="text-sm text-yellow-400">⚠ 2FA is currently disabled. Enable it to secure your account.</p>
          </div>
        )}
      </div>
    );
  }

  /* ===== Sessions Panel ===== */
  function SessionsPanel() {
    const [sessions, setSessions] = useState([
      { id: '1', device: 'Windows PC', browser: 'Chrome 125', location: 'Nairobi, Kenya', ip: '192.168.1.100', lastActive: 'Now', current: true },
      { id: '2', device: 'iPhone 15', browser: 'Safari', location: 'Nairobi, Kenya', ip: '192.168.1.101', lastActive: '2 days ago', current: false },
    ]);

    const handleRevoke = (id: string) => {
      setSessions(sessions.filter(s => s.id !== id));
    };

    return (
      <div className="glass-lg rounded-xl p-6 max-w-2xl">
        <h3 className="text-lg font-serif text-white mb-4">Active Sessions</h3>
        <p className="text-sm text-slate-400 mb-4">Manage your active sessions. Revoke any sessions you don't recognize.</p>
        <div className="space-y-3">
          {sessions.map((session) => (
            <div key={session.id} className={`flex items-center justify-between p-4 rounded-lg border ${session.current ? 'bg-green-500/5 border-green-500/20' : 'bg-white/[0.02] border-white/10'}`}>
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${session.current ? 'bg-green-500' : 'bg-slate-500'}`} />
                <div>
                  <p className="text-sm text-white font-medium">{session.device} • {session.browser}</p>
                  <p className="text-xs text-slate-500">{session.location} • {session.ip}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${session.current ? 'text-green-400' : 'text-slate-500'}`}>
                  {session.current ? 'Active now' : session.lastActive}
                </span>
                {!session.current && (
                  <button onClick={() => handleRevoke(session.id)} className="px-3 py-1 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">Revoke</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Content Area ───────────────────────────────────────────────────
  const contentArea = (
    <div className={`transition-all duration-300 pt-16 ${sidebarCollapsed ? 'ml-16' : 'ml-56'}`}>
      <div className="p-6 lg:p-8">
        {activeSection === 'overview' && <OverviewSection />}
        {activeSection === 'verification' && <VerificationSection />}
        {activeSection === 'leads' && <LeadsSection />}
        {activeSection === 'mailer' && <MailerSection />}
        {activeSection === 'smtp-store' && <SmtpStoreSection />}
        {activeSection === 'wallet' && <WalletSection />}
        {activeSection === 'documents' && <DocumentsSection />}
        {activeSection === 'bomber' && (
          <div className="animate-fade-in relative min-h-[300px] p-6 rounded-2xl overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-2xl"
              style={{ backgroundImage: "url('/landing-bg.png')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/60 rounded-2xl" />
            <div className="relative z-10">
              <EmailBomberCard />
            </div>
          </div>
        )}
        {activeSection === 'rdp-store' && (
          <div className="animate-fade-in relative min-h-[300px] p-6 rounded-2xl overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-2xl"
              style={{ backgroundImage: "url('/landing-bg.png')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/60 rounded-2xl" />
            <div className="relative z-10">
              <RdpStoreCard />
            </div>
          </div>
        )}
        {activeSection === 'cpanel-store' && (
          <div className="animate-fade-in relative min-h-[300px] p-6 rounded-2xl overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-2xl"
              style={{ backgroundImage: "url('/landing-bg.png')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/60 rounded-2xl" />
            <div className="relative z-10">
              <CpanelStoreCard />
            </div>
          </div>
        )}
        {activeSection === 'links' && (
          <div className="animate-fade-in relative min-h-[300px] p-6 rounded-2xl overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat rounded-2xl"
              style={{ backgroundImage: "url('/landing-bg.png')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/60 rounded-2xl" />
            <div className="relative z-10">
              <div className="mb-6">
                <h2 className="text-2xl font-serif text-white">🔗 URL Shortener</h2>
                <p className="text-foreground-secondary text-sm mt-1">Create short, trackable links and manage all your shortened URLs</p>
              </div>
              {user && <UrlShortenerCard userId={user.id} />}
            </div>
          </div>
        )}
        {activeSection === 'settings' && <SettingsSection />}
      </div>
    </div>
  );

  // ─── Processing Modal ──────────────────────────────────────────────
  const processingModal = isProcessing && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="rounded-2xl border border-white/[0.08] bg-black/90 backdrop-blur-xl p-8 max-w-md w-full mx-4 text-center">
        <div className="flex justify-center mb-6">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-accent-gold border-r-accent-neon-blue animate-spin" />
            <div className="absolute inset-3 rounded-full border-2 border-accent-gold/30 animate-pulse" />
            <div className="absolute inset-6 rounded-full bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/20" />
            <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 rounded-full bg-accent-gold animate-pulse" /></div>
          </div>
        </div>
        <h3 className="text-xl font-serif text-white mb-1">Processing Document</h3>
        <p className="text-sm text-foreground-secondary font-mono mb-5">{processingFile}</p>
        <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden mb-5">
          <div className="bg-gradient-to-r from-accent-gold via-accent-neon-blue to-accent-gold h-full rounded-full transition-all duration-700" style={{ width: `${processingProgress}%` }} />
        </div>
        <div className="space-y-2 text-left">
          {[
            { label: 'Extracting content', done: true },
            { label: 'Processing with AI', active: true },
            { label: 'Finalizing', done: false },
          ].map((step, i) => (
            <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs ${step.done ? 'bg-emerald-500/5 border-emerald-500/20' : step.active ? 'bg-accent-gold/5 border-accent-gold/30 animate-pulse' : 'bg-white/5 border-white/10 opacity-40'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-emerald-500/20 text-emerald-400' : step.active ? 'bg-accent-gold/20 text-accent-gold' : 'bg-white/10 text-foreground-secondary'}`}>
                {step.done ? '✓' : i + 1}
              </div>
              <span className={step.active ? 'text-white font-medium' : 'text-foreground-secondary'}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#050505]">
        {sidebar}
        {topBar}
        {contentArea}
        {processingModal}
      </div>
    </ProtectedRoute>
  );
}