'use client';

import { useState, useEffect } from 'react';

interface Template {
  id: string;
  name: string;
}

interface RecipientList {
  id: string;
  name: string;
}

interface CampaignFormProps {
  onSave: (data: any) => void;
  onCancel: () => void;
}

export default function CampaignForm({ onSave, onCancel }: CampaignFormProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recipientLists, setRecipientLists] = useState<RecipientList[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    templateId: '',
    recipientListId: '',
    senderEmail: '',
    senderName: '',
    emailProvider: 'nodemailer',
  });

  useEffect(() => {
    fetchTemplates();
    fetchRecipientLists();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/mailer/templates');
      if (response.ok) {
        setTemplates(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const fetchRecipientLists = async () => {
    try {
      const response = await fetch('/api/mailer/recipients');
      if (response.ok) {
        setRecipientLists(await response.json());
      }
    } catch (error) {
      console.error('Failed to fetch recipient lists:', error);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur">
      <div className="border-b border-slate-700 px-6 py-4">
        <h2 className="text-lg font-semibold text-white">Create New Campaign</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Campaign Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Q1 2024 Newsletter"
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Description (Optional)
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Campaign details..."
            rows={3}
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Email Template
          </label>
          <select
            name="templateId"
            value={formData.templateId}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            required
          >
            <option value="">Select a template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Recipient List
          </label>
          <select
            name="recipientListId"
            value={formData.recipientListId}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            required
          >
            <option value="">Select a recipient list...</option>
            {recipientLists.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Sender Email
          </label>
          <input
            type="email"
            name="senderEmail"
            value={formData.senderEmail}
            onChange={handleChange}
            placeholder="noreply@yourdomain.com"
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Sender Name (Optional)
          </label>
          <input
            type="text"
            name="senderName"
            value={formData.senderName}
            onChange={handleChange}
            placeholder="Your Company Name"
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Email Provider
          </label>
          <select
            name="emailProvider"
            value={formData.emailProvider}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="nodemailer">Nodemailer (SMTP)</option>
            <option value="sendgrid">SendGrid</option>
          </select>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 font-medium text-white transition-all hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50"
          >
            {isSaving ? 'Creating...' : 'Create Campaign'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 font-medium text-slate-300 transition-colors hover:bg-slate-700/50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
