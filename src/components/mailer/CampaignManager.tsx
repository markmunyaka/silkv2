'use client';

import { useState, useEffect } from 'react';
import CampaignForm from './CampaignForm';
import CampaignList from './CampaignList';
import CampaignDetails from './CampaignDetails';

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
  updatedAt: string;
  template?: {
    id: string;
    name: string;
    subject: string;
  };
  recipientList?: {
    id: string;
    name: string;
    totalCount: number;
  };
}

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/mailer/campaigns');
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    try {
      const response = await fetch('/api/mailer/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });

      if (response.ok) {
        await fetchCampaigns();
        const campaign = campaigns.find(c => c.id === campaignId);
        if (campaign) {
          setSelectedCampaign({ ...campaign, status: 'completed' });
        }
      }
    } catch (error) {
      console.error('Failed to send campaign:', error);
    }
  };

  const handleCreateCampaign = async (campaignData: any) => {
    try {
      const response = await fetch('/api/mailer/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData),
      });

      if (response.ok) {
        await fetchCampaigns();
        setShowForm(false);
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: List */}
      <div className="lg:col-span-1">
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur">
          <div className="border-b border-slate-700 px-6 py-4">
            <button
              onClick={() => setShowForm(true)}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 font-medium text-white transition-all hover:from-blue-700 hover:to-cyan-700"
            >
              + New Campaign
            </button>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="px-6 py-8 text-center text-slate-400">Loading...</div>
            ) : campaigns.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400">No campaigns yet</div>
            ) : (
              <CampaignList
                campaigns={campaigns}
                selectedId={selectedCampaign?.id}
                onSelect={setSelectedCampaign}
              />
            )}
          </div>
        </div>
      </div>

      {/* Right: Form or Details */}
      <div className="lg:col-span-2">
        {showForm ? (
          <CampaignForm
            onSave={handleCreateCampaign}
            onCancel={() => setShowForm(false)}
          />
        ) : selectedCampaign ? (
          <CampaignDetails
            campaign={selectedCampaign}
            onSend={() => handleSendCampaign(selectedCampaign.id)}
          />
        ) : (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur px-6 py-12 text-center">
            <p className="text-slate-400">Select a campaign or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}
