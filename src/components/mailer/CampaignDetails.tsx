'use client';

import { useState } from 'react';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  emailProvider: string;
  senderEmail: string;
  senderName?: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  template?: {
    id: string;
    name: string;
    subject: string;
  };
  recipientList?: {
    id: string;
    name: string;
  };
}

interface CampaignDetailsProps {
  campaign: Campaign;
  onSend: () => void;
}

export default function CampaignDetails({ campaign, onSend }: CampaignDetailsProps) {
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    try {
      await onSend();
    } finally {
      setIsSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-slate-700 text-slate-200';
      case 'in_progress':
        return 'bg-blue-700 text-blue-200';
      case 'completed':
        return 'bg-green-700 text-green-200';
      case 'failed':
        return 'bg-red-700 text-red-200';
      default:
        return 'bg-slate-700 text-slate-200';
    }
  };

  const successRate = campaign.totalRecipients > 0 
    ? Math.round((campaign.sentCount / campaign.totalRecipients) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur overflow-hidden">
      <div className="border-b border-slate-700 px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{campaign.name}</h2>
            {campaign.description && (
              <p className="text-sm text-slate-400 mt-1">{campaign.description}</p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(campaign.status)}`}>
            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1).replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
            <p className="text-sm text-slate-400">Total Recipients</p>
            <p className="text-3xl font-bold text-white mt-2">{campaign.totalRecipients}</p>
          </div>
          {campaign.sentCount > 0 && (
            <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
              <p className="text-sm text-slate-400">Success Rate</p>
              <p className="text-3xl font-bold text-green-400 mt-2">{successRate}%</p>
              <p className="text-xs text-slate-500 mt-1">{campaign.sentCount} sent, {campaign.failedCount} failed</p>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Email Template</p>
            <p className="text-sm text-white mt-1">{campaign.template?.name}</p>
            <p className="text-xs text-slate-500">Subject: {campaign.template?.subject}</p>
          </div>

          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Recipient List</p>
            <p className="text-sm text-white mt-1">{campaign.recipientList?.name}</p>
          </div>

          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Sender Information</p>
            <p className="text-sm text-white mt-1">{campaign.senderName || 'Mailer'}</p>
            <p className="text-xs text-slate-500">{campaign.senderEmail}</p>
          </div>

          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Email Provider</p>
            <p className="text-sm text-white mt-1 capitalize">{campaign.emailProvider}</p>
          </div>

          {campaign.sentAt && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Sent At</p>
              <p className="text-sm text-white mt-1">
                {new Date(campaign.sentAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Action */}
        {campaign.status === 'draft' && (
          <div className="border-t border-slate-700 pt-6">
            <button
              onClick={handleSend}
              disabled={isSending}
              className="w-full rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 font-medium text-white transition-all hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
            >
              {isSending ? 'Sending Campaign...' : '🚀 Send Campaign'}
            </button>
            <p className="text-xs text-slate-400 mt-3 text-center">
              This will send emails to all {campaign.totalRecipients} recipients
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
