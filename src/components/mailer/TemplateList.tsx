'use client';

interface Template {
  id: string;
  name: string;
  subject: string;
  description?: string;
  createdAt: string;
}

interface TemplateListProps {
  templates: Template[];
  selectedId?: string;
  onSelect: (template: Template) => void;
  onEdit: (template: Template) => void;
  onDelete: (id: string) => void;
}

export default function TemplateList({
  templates,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
}: TemplateListProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="divide-y divide-slate-700">
      {templates.map(template => (
        <div
          key={template.id}
          className={`cursor-pointer border-l-2 px-6 py-4 transition-colors ${
            selectedId === template.id
              ? 'border-l-blue-500 bg-slate-700/50'
              : 'border-l-transparent hover:bg-slate-700/30'
          }`}
          onClick={() => onSelect(template)}
        >
          <div className="mb-1 flex items-start justify-between">
            <h3 className="font-medium text-white">{template.name}</h3>
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(template);
                }}
                className="rounded p-1 hover:bg-slate-600 text-slate-400 hover:text-slate-200"
                title="Edit"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this template?')) {
                    onDelete(template.id);
                  }
                }}
                className="rounded p-1 hover:bg-slate-600 text-slate-400 hover:text-red-400"
                title="Delete"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-400 truncate">{template.subject}</p>
          <p className="text-xs text-slate-500 mt-2">{formatDate(template.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}
