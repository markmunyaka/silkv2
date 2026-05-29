'use client';

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

interface TemplatePreviewProps {
  template: Template;
}

export default function TemplatePreview({ template }: TemplatePreviewProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 backdrop-blur overflow-hidden">
      <div className="border-b border-slate-700 px-6 py-4">
        <h2 className="text-lg font-semibold text-white">{template.name}</h2>
        <p className="text-sm text-slate-400 mt-1">Subject: {template.subject}</p>
        {template.description && (
          <p className="text-sm text-slate-500 mt-2">{template.description}</p>
        )}
      </div>

      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Preview</h3>
          <div className="rounded-lg bg-white p-6 text-slate-900">
            <div
              dangerouslySetInnerHTML={{
                __html: template.htmlContent,
              }}
              className="prose prose-sm max-w-none"
            />
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">HTML Code</h3>
          <pre className="rounded-lg bg-slate-900/70 p-4 overflow-x-auto text-xs text-slate-300">
            <code>{template.htmlContent}</code>
          </pre>
        </div>

        {template.textContent && (
          <div className="border-t border-slate-700 pt-4 mt-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Text Version</h3>
            <pre className="rounded-lg bg-slate-900/70 p-4 overflow-x-auto text-xs text-slate-300 whitespace-pre-wrap">
              <code>{template.textContent}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
