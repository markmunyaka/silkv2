'use client';

import { useState, useEffect } from 'react';

interface TemplateFormProps {
  template?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
}

export default function TemplateForm({ template, onSave, onCancel }: TemplateFormProps) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    subject: template?.subject || '',
    htmlContent: template?.htmlContent || '',
    textContent: template?.textContent || '',
    description: template?.description || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
        <h2 className="text-lg font-semibold text-white">
          {template ? 'Edit Template' : 'Create New Template'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Template Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Welcome Email"
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Email Subject
          </label>
          <input
            type="text"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            placeholder="e.g., Welcome to our service!"
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Description (Optional)
          </label>
          <input
            type="text"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="e.g., Welcome email for new users"
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            HTML Content
          </label>
          <p className="text-xs text-slate-400 mb-2">
            Use {"{{firstName}}"}, {"{{lastName}}"}, etc. for dynamic variables
          </p>
          <textarea
            name="htmlContent"
            value={formData.htmlContent}
            onChange={handleChange}
            placeholder="<h1>Welcome {{firstName}}!</h1>..."
            rows={10}
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 font-mono text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Text Content (Optional)
          </label>
          <textarea
            name="textContent"
            value={formData.textContent}
            onChange={handleChange}
            placeholder="Plain text version of your email..."
            rows={6}
            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 font-mono text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 font-medium text-white transition-all hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
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
