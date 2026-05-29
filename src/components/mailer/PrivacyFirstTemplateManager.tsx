'use client';

import { useState, useEffect } from 'react';

interface Template {
  id: string;
  name: string;
  subject: string;
  description?: string;
  createdAt: string;
}

// Store templates in localStorage for privacy (no server DB storage)
const STORAGE_KEY = 'silk_mailer_templates';

function loadTemplates(): Template[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveTemplates(templates: Template[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

interface TemplateFormData {
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  description: string;
}

function TemplateForm({ 
  template, 
  onSave, 
  onCancel 
}: { 
  template?: Template | null; 
  onSave: (data: any) => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<TemplateFormData>({
    name: template?.name || '',
    subject: template?.subject || '',
    htmlContent: '',
    textContent: '',
    description: template?.description || '',
  });
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        subject: template.subject,
        htmlContent: '',
        textContent: '',
        description: template.description || '',
      });
    }
  }, [template]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      htmlContent: htmlContent || '<p>Email content</p>',
      textContent: textContent || 'Email content',
    });
  };

  return (
    <div className="glass-lg rounded-xl p-6">
      <h2 className="text-xl font-serif text-white mb-6">
        {template ? 'Edit Template' : 'Create New Template'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">
            Template Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Welcome Email"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">
            Email Subject
          </label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="e.g., Welcome to our platform!"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">
            Description (Optional)
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of this template"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">
            HTML Content
          </label>
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            placeholder="<p>Your email HTML content here...</p>"
            rows={8}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/20"
          />
          <p className="text-xs text-slate-500 mt-2">Privacy: Content is sent directly, never stored on server</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-2">
            Plain Text Content (Optional)
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Plain text version of your email..."
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/20"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-4 py-2.5 font-medium text-black transition-all hover:shadow-lg hover:shadow-accent-gold/30"
          >
            {template ? 'Update Template' : 'Create Template'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 font-medium text-foreground-secondary transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function TemplateCard({ 
  template, 
  onEdit, 
  onDelete 
}: { 
  template: Template; 
  onEdit: () => void; 
  onDelete: () => void;
}) {
  return (
    <div className="group p-4 border border-white/10 rounded-lg hover:border-accent-gold/50 transition-all cursor-pointer"
         onClick={onEdit}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-medium text-white group-hover:text-accent-gold transition-colors">
            {template.name}
          </h3>
          <p className="text-sm text-slate-400 mt-1">{template.subject}</p>
          {template.description && (
            <p className="text-xs text-slate-500 mt-2 line-clamp-2">{template.description}</p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-400 transition-all"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const handleSaveTemplate = (templateData: any) => {
    const now = new Date().toISOString();
    
    if (editingTemplate) {
      const updated = templates.map(t => 
        t.id === editingTemplate.id 
          ? { ...t, ...templateData, subject: templateData.subject, updatedAt: now }
          : t
      );
      setTemplates(updated);
      saveTemplates(updated);
      setSelectedTemplate(updated.find(t => t.id === editingTemplate.id) || null);
    } else {
      const newTemplate: Template = {
        id: `template_${Date.now()}`,
        name: templateData.name,
        subject: templateData.subject,
        description: templateData.description,
        createdAt: now,
      };
      const updated = [newTemplate, ...templates];
      setTemplates(updated);
      saveTemplates(updated);
    }
    
    setShowForm(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
    if (selectedTemplate?.id === id) {
      setSelectedTemplate(null);
    }
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: List */}
      <div className="lg:col-span-1">
        <div className="glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 p-4">
            <button
              onClick={() => {
                setEditingTemplate(null);
                setShowForm(true);
              }}
              className="w-full rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-4 py-2.5 font-medium text-black transition-all hover:shadow-lg hover:shadow-accent-gold/30"
            >
              + New Template
            </button>
          </div>

          <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
            {templates.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <p>No templates yet</p>
                <p className="text-xs mt-2">Privacy: Templates stored locally only</p>
              </div>
            ) : (
              templates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={() => handleEditTemplate(template)}
                  onDelete={() => handleDeleteTemplate(template.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right: Form or Preview */}
      <div className="lg:col-span-2">
        {showForm ? (
          <TemplateForm
            template={editingTemplate}
            onSave={handleSaveTemplate}
            onCancel={() => {
              setShowForm(false);
              setEditingTemplate(null);
            }}
          />
        ) : selectedTemplate ? (
          <div className="glass-lg rounded-xl p-6">
            <h2 className="text-xl font-serif text-white mb-4">{selectedTemplate.name}</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-400">Subject</p>
                <p className="text-white">{selectedTemplate.subject}</p>
              </div>
              {selectedTemplate.description && (
                <div>
                  <p className="text-sm text-slate-400">Description</p>
                  <p className="text-white">{selectedTemplate.description}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass rounded-xl px-6 py-12 text-center">
            <p className="text-slate-400">Select a template or create a new one</p>
            <p className="text-xs text-slate-500 mt-2">Your templates are stored locally and never sent to our servers</p>
          </div>
        )}
      </div>
    </div>
  );
}