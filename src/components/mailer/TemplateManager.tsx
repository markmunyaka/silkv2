'use client';

import { useState, useEffect } from 'react';
import TemplateForm from './TemplateForm';
import TemplateList from './TemplateList';
import TemplatePreview from './TemplatePreview';

interface Template {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export default function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/mailer/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTemplate = async (templateData: any) => {
    try {
      const method = editingTemplate ? 'PUT' : 'POST';
      const url = editingTemplate
        ? `/api/mailer/templates/${editingTemplate.id}`
        : '/api/mailer/templates';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
      });

      if (response.ok) {
        await fetchTemplates();
        setShowForm(false);
        setEditingTemplate(null);
        setSelectedTemplate(null);
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const response = await fetch(`/api/mailer/templates/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchTemplates();
        if (selectedTemplate?.id === id) {
          setSelectedTemplate(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
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
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur">
          <div className="border-b border-slate-700 px-6 py-4">
            <button
              onClick={() => {
                setEditingTemplate(null);
                setShowForm(true);
              }}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2.5 font-medium text-white transition-all hover:from-blue-700 hover:to-cyan-700"
            >
              + New Template
            </button>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="px-6 py-8 text-center text-slate-400">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400">No templates yet</div>
            ) : (
              <TemplateList
                templates={templates}
                selectedId={selectedTemplate?.id}
                onSelect={setSelectedTemplate}
                onEdit={handleEditTemplate}
                onDelete={handleDeleteTemplate}
              />
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
          <TemplatePreview template={selectedTemplate} />
        ) : (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur px-6 py-12 text-center">
            <p className="text-slate-400">Select a template to preview or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}
