'use client';

interface RecipientList {
  id: string;
  name: string;
  description?: string;
  totalCount: number;
  createdAt: string;
  _count?: {
    recipients: number;
  };
}

interface RecipientListViewProps {
  list: RecipientList;
}

export default function RecipientListView({ list }: RecipientListViewProps) {
  const count = list._count?.recipients || list.totalCount;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur overflow-hidden">
      <div className="border-b border-slate-700 px-6 py-4">
        <h2 className="text-lg font-semibold text-white">{list.name}</h2>
        {list.description && (
          <p className="text-sm text-slate-400 mt-1">{list.description}</p>
        )}
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
            <p className="text-sm text-slate-400">Total Recipients</p>
            <p className="text-3xl font-bold text-white mt-2">{count}</p>
          </div>
          <div className="rounded-lg bg-slate-900/50 p-4 border border-slate-700">
            <p className="text-sm text-slate-400">Created</p>
            <p className="text-sm text-white mt-2">
              {new Date(list.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">List Information</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400">List ID</p>
              <p className="text-sm text-slate-200 font-mono">{list.id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-green-900/20 px-3 py-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm text-green-400">Active</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-blue-900/20 border border-blue-800/50 px-4 py-3">
          <p className="text-sm text-blue-400">
            💡 This recipient list is ready to be used in email campaigns. Select it when creating a new campaign.
          </p>
        </div>
      </div>
    </div>
  );
}
