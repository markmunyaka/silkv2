'use client';

import { useState, useEffect } from 'react';
import CSVUploader from './CSVUploader';
import RecipientListView from './RecipientListView';

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

export default function RecipientManager() {
  const [recipientLists, setRecipientLists] = useState<RecipientList[]>([]);
  const [selectedList, setSelectedList] = useState<RecipientList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);

  useEffect(() => {
    fetchRecipientLists();
  }, []);

  const fetchRecipientLists = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/mailer/recipients');
      if (response.ok) {
        const data = await response.json();
        setRecipientLists(data);
      }
    } catch (error) {
      console.error('Failed to fetch recipient lists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    fetchRecipientLists();
    setShowUploader(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: List */}
      <div className="lg:col-span-1">
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur">
          <div className="border-b border-slate-700 px-6 py-4">
            <button
              onClick={() => setShowUploader(true)}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 font-medium text-white transition-all hover:from-blue-700 hover:to-cyan-700"
            >
              + Import Recipients
            </button>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="px-6 py-8 text-center text-slate-400">Loading...</div>
            ) : recipientLists.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400">No recipient lists yet</div>
            ) : (
              <div className="divide-y divide-slate-700">
                {recipientLists.map(list => (
                  <div
                    key={list.id}
                    onClick={() => setSelectedList(list)}
                    className={`cursor-pointer border-l-2 px-6 py-4 transition-colors ${
                      selectedList?.id === list.id
                        ? 'border-l-blue-500 bg-slate-700/50'
                        : 'border-l-transparent hover:bg-slate-700/30'
                    }`}
                  >
                    <h3 className="font-medium text-white">{list.name}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {list.totalCount} recipient{list.totalCount !== 1 ? 's' : ''}
                    </p>
                    {list.description && (
                      <p className="text-xs text-slate-500 mt-2">{list.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Upload or Details */}
      <div className="lg:col-span-2">
        {showUploader ? (
          <CSVUploader
            onSuccess={handleUploadSuccess}
            onCancel={() => setShowUploader(false)}
          />
        ) : selectedList ? (
          <RecipientListView list={selectedList} />
        ) : (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur px-6 py-12 text-center">
            <p className="text-slate-400">Import recipient lists or select one to view</p>
          </div>
        )}
      </div>
    </div>
  );
}
