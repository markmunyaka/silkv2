'use client';

import { useState, useEffect, useCallback } from 'react';
import LegalGatekeeper from './LegalGatekeeper';
import { useAuth } from '@/context/AuthContext';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  senderEmail: string;
  senderName?: string;
  emailProvider: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  sentAt?: string;
  createdAt: string;
  templateName?: string;
  templateSubject?: string;
  recipientListName?: string;
  recipientListId?: string;
}

interface EmailStatus {
  email: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  error?: string;
  timestamp?: string;
}

interface SmtpProviderOption {
  id: string;
  name: string;
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  fromEmail: string;
  fromName: string | null;
  maxEmailsPerDay: number;
  maxEmailsPerHour: number;
  delayBetweenEmailsMs: number;
  testStatus: string | null;
}

interface CampaignFormData {
  name: string;
  description: string;
  senderEmail: string;
  senderName: string;
  emailProvider: string;
  providerId: string;
  templateId: string;
  templateName: string;
  templateSubject: string;
  recipientListId: string;
  recipientListName: string;
  totalRecipients: number;
}

function CampaignForm({ onSave, onCancel }: { onSave: (data: CampaignFormData) => void; onCancel: () => void }) {
  const [providers, setProviders] = useState<SmtpProviderOption[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '', description: '', senderEmail: '', senderName: '',
    emailProvider: 'nodemailer', providerId: '', templateId: '', templateName: '',
    templateSubject: '', recipientListId: '', recipientListName: '', totalRecipients: 0,
  });

  useEffect(() => {
    fetch('/api/mailer/providers')
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.data) setProviders(json.data);
      })
      .catch(() => {})
      .finally(() => setLoadingProviders(false));
  }, []);

  const handleProviderSelect = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (provider) {
      setFormData({
        ...formData,
        providerId: provider.id,
        emailProvider: provider.provider,
        senderEmail: provider.fromEmail,
        senderName: provider.fromName || formData.senderName,
      });
    } else {
      setFormData({ ...formData, providerId: '', emailProvider: 'nodemailer' });
    }
  };

  const loadTemplates = (): any[] => {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem('silk_mailer_templates') || '[]');
  };

  const loadRecipientLists = (): any[] => {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem('silk_mailer_recipients') || '[]');
  };

  const templates = loadTemplates();
  const recipientLists = loadRecipientLists();

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t: any) => t.id === templateId);
    setFormData({ ...formData, templateId, templateName: template?.name || '', templateSubject: template?.subject || '' });
  };

  const handleRecipientListChange = (listId: string) => {
    const list = recipientLists.find((l: any) => l.id === listId);
    setFormData({ ...formData, recipientListId: listId, recipientListName: list?.name || '', totalRecipients: list?.totalCount || 0 });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="glass-lg rounded-xl p-6">
      <h2 className="text-xl font-serif text-white mb-6">Create New Campaign</h2>
      <div className="bg-accent-neon-blue/10 border border-accent-neon-blue/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-accent-neon-blue">🔒 <strong>Privacy-Safe:</strong> Emails sent directly from our servers. Campaign data stored in database.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">Campaign Name</label>
          <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Q1 2024 Newsletter" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">Email Template</label>
          <select value={formData.templateId} onChange={(e) => handleTemplateChange(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" required>
            <option value="">Select a template...</option>
            {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">Recipient List</label>
          <select value={formData.recipientListId} onChange={(e) => handleRecipientListChange(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none" required>
            <option value="">Select a recipient list...</option>
            {recipientLists.map((l: any) => <option key={l.id} value={l.id}>{l.name} ({l.totalCount})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">
            SMTP Provider <span className="text-xs text-foreground-secondary/60">(admin-configured)</span>
          </label>
          {loadingProviders ? (
            <div className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-500">Loading providers...</div>
          ) : providers.length === 0 ? (
            <div className="w-full rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
              ⚠️ No SMTP providers available. Contact your admin to configure one.
            </div>
          ) : (
            <select value={formData.providerId} onChange={(e) => handleProviderSelect(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-accent-gold focus:outline-none">
              <option value="">Select a provider...</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.host}) - {p.fromEmail}{p.testStatus === 'passed' ? ' ✅' : p.testStatus === 'failed' ? ' ❌' : ''}</option>
              ))}
            </select>
          )}
          {formData.providerId && (
            <p className="text-xs text-emerald-400 mt-1">✅ Using {providers.find((p) => p.id === formData.providerId)?.name || 'selected provider'}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">Sender Email</label>
            <input type="email" value={formData.senderEmail} onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })} placeholder="noreply@domain.com" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-2">Sender Name</label>
            <input type="text" value={formData.senderName} onChange={(e) => setFormData({ ...formData, senderName: e.target.value })} placeholder="Your Company" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none" />
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={!formData.templateId || !formData.recipientListId} className="flex-1 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-4 py-2.5 font-medium text-black transition-all hover:shadow-lg hover:shadow-accent-gold/30 disabled:opacity-50">Create Campaign</button>
          <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 font-medium text-foreground-secondary transition-colors hover:bg-white/5">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function CampaignDetails({ campaign, onSend, isSending }: {
  campaign: Campaign;
  onSend: () => void;
  isSending: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  return (
    <div className="glass-lg rounded-xl p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-serif text-white">{campaign.name}</h2>
          {campaign.description && <p className="text-sm text-slate-400 mt-1">{campaign.description}</p>}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm ${
          campaign.status === 'draft' ? 'bg-slate-600 text-slate-300' : 
          campaign.status === 'in_progress' ? 'bg-blue-600/30 text-blue-400 animate-pulse' :
          campaign.status === 'completed' ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'
        }`}>{campaign.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-white/5 rounded-lg"><p className="text-xs text-slate-400 uppercase tracking-wider">Template</p><p className="text-white mt-1">{campaign.templateName || 'N/A'}</p></div>
        <div className="p-4 bg-white/5 rounded-lg"><p className="text-xs text-slate-400 uppercase tracking-wider">Recipients</p><p className="text-white mt-1">{campaign.recipientListName || 'N/A'}</p></div>
        <div className="p-4 bg-white/5 rounded-lg"><p className="text-xs text-slate-400 uppercase tracking-wider">Sender</p><p className="text-white mt-1">{campaign.senderName || 'Mailer'}</p><p className="text-xs text-slate-500">{campaign.senderEmail}</p></div>
        <div className="p-4 bg-white/5 rounded-lg"><p className="text-xs text-slate-400 uppercase tracking-wider">Provider</p><p className="text-white mt-1 capitalize">{campaign.emailProvider}</p></div>
      </div>

      {campaign.status === 'draft' && (
        <>
          <LegalGatekeeper onAgreedChange={setTermsAccepted} />
          <div className="mt-6 bg-accent-gold/10 border border-accent-gold/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-accent-gold">🔒 Ready to send via server-side SMTP.</p>
          </div>
          <button
            onClick={onSend}
            disabled={isSending || !termsAccepted}
            className={`w-full rounded-lg px-4 py-3 font-medium transition-all ${
              termsAccepted
                ? 'bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-lg hover:shadow-accent-gold/30'
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
            } disabled:opacity-50`}
          >
            {isSending ? 'Sending...' : termsAccepted ? `Send to ${campaign.totalRecipients.toLocaleString()} recipients` : 'Accept terms to send'}
          </button>
        </>
      )}
      {campaign.status === 'completed' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center"><p className="text-2xl font-serif text-accent-gold">{campaign.totalRecipients}</p><p className="text-xs text-slate-400">Total</p></div>
            <div className="text-center"><p className="text-2xl font-serif text-green-400">{campaign.sentCount}</p><p className="text-xs text-slate-400">Sent</p></div>
            <div className="text-center"><p className="text-2xl font-serif text-red-400">{campaign.failedCount}</p><p className="text-xs text-slate-400">Failed</p></div>
          </div>
          {campaign.sentAt && <p className="text-center text-xs text-slate-500">Sent on {new Date(campaign.sentAt).toLocaleString()}</p>}
        </div>
      )}
    </div>
  );
}

export default function CampaignManager() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/mailer/campaigns?userId=${user.id}`);
      const json = await res.json();
      if (json.ok) setCampaigns(json.data);
    } catch (err) { console.error('Failed to fetch campaigns', err); }
  }, [user?.id]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleCreateCampaign = async (campaignData: CampaignFormData) => {
    if (!user?.id) return;
    setError(null);
    try {
      const res = await fetch('/api/mailer/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id, name: campaignData.name, description: campaignData.description,
          templateId: campaignData.templateId, recipientListId: campaignData.recipientListId,
          senderEmail: campaignData.senderEmail, senderName: campaignData.senderName,
          emailProvider: campaignData.emailProvider, totalRecipients: campaignData.totalRecipients,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        await fetchCampaigns();
        setShowForm(false);
        setSelectedCampaign(json.data);
      } else setError(json.error || 'Failed to create campaign');
    } catch (err: any) { setError(err.message); }
  };

  const handleSendCampaign = async (campaign: Campaign) => {
    if (!user?.id) return;
    setError(null);
    if (!confirm(`Send email to ${campaign.totalRecipients.toLocaleString()} recipients?`)) return;
    setSendingCampaignId(campaign.id);
    try {
      const res = await fetch('/api/mailer/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id, userId: user.id }),
      });
      const json = await res.json();
      if (json.ok) {
        await fetchCampaigns();
        setSendingCampaignId(null);
      } else {
        setError(json.error || 'Failed to send');
        setSendingCampaignId(null);
      }
    } catch (err: any) { setError(err.message); setSendingCampaignId(null); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 p-4">
            <button onClick={() => setShowForm(true)} className="w-full rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-4 py-2.5 font-medium text-black transition-all hover:shadow-lg hover:shadow-accent-gold/30">+ New Campaign</button>
          </div>
          <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
            {campaigns.length === 0 ? (
              <div className="py-8 text-center text-slate-400"><p>No campaigns yet</p></div>
            ) : campaigns.map(campaign => (
              <div key={campaign.id} onClick={() => setSelectedCampaign(campaign)}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedCampaign?.id === campaign.id ? 'border-accent-gold/50 bg-accent-gold/10' : 'border-white/10 hover:border-white/30'}`}>
                <h3 className="font-medium text-white">{campaign.name}</h3>
                <p className="text-sm text-slate-400 mt-1">{campaign.totalRecipients} recipients • {campaign.status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="lg:col-span-2">
        {error && (<div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>)}
        {showForm ? <CampaignForm onSave={handleCreateCampaign} onCancel={() => setShowForm(false)} />
        : selectedCampaign ? <CampaignDetails campaign={selectedCampaign} onSend={() => handleSendCampaign(selectedCampaign)} isSending={sendingCampaignId === selectedCampaign.id} />
        : <div className="glass rounded-xl px-6 py-12 text-center"><p className="text-slate-400">Select a campaign or create a new one</p></div>}
      </div>
    </div>
  );
}