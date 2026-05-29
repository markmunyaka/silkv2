'use client';

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  template?: {
    name: string;
  };
}

interface CampaignListProps {
  campaigns: Campaign[];
  selectedId?: string;
  onSelect: (campaign: Campaign) => void;
}

export default function CampaignList({ campaigns, selectedId, onSelect }: CampaignListProps) {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="divide-y divide-slate-700">
      {campaigns.map(campaign => (
        <div
          key={campaign.id}
          onClick={() => onSelect(campaign)}
          className={`cursor-pointer border-l-2 px-6 py-4 transition-colors ${
            selectedId === campaign.id
              ? 'border-l-blue-500 bg-slate-700/50'
              : 'border-l-transparent hover:bg-slate-700/30'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-medium text-white">{campaign.name}</h3>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                campaign.status
              )}`}
            >
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1).replace('_', ' ')}
            </span>
          </div>

          {campaign.template && (
            <p className="text-sm text-slate-400">{campaign.template.name}</p>
          )}

          <div className="mt-2 flex gap-4 text-xs text-slate-400">
            <span>{campaign.totalRecipients} recipients</span>
            {campaign.sentCount > 0 && <span className="text-green-400">{campaign.sentCount} sent</span>}
            {campaign.failedCount > 0 && <span className="text-red-400">{campaign.failedCount} failed</span>}
          </div>

          <p className="text-xs text-slate-500 mt-2">{formatDate(campaign.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}
