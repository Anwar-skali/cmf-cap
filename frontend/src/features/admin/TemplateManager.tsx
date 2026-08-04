import React, { useState } from 'react';
import { useTemplate } from '@/context/TemplateContext';
import { CMFTemplate } from '@/types/template';
import { templatesApi } from '@/api/templates';
import { TemplateEditor } from './TemplateEditor';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import {
  FileCheck,
  Plus,
  Copy,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  Archive,
  Download,
  Upload,
  Layers,
  FileCode,
} from 'lucide-react';
import { toast } from 'sonner';

export const TemplateManager: React.FC = () => {
  const { templates, fetchTemplates } = useTemplate();
  const [editingTemplate, setEditingTemplate] = useState<CMFTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<CMFTemplate | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTemplateCode, setNewTemplateCode] = useState<string>('K10');
  const [newTemplateName, setNewTemplateName] = useState<string>('CMF K10 Template');

  const handleDuplicate = async (id: string) => {
    try {
      await templatesApi.duplicateTemplate(id);
      toast.success('Template duplicated successfully');
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to duplicate template');
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await templatesApi.publishTemplate(id);
      toast.success('Template published successfully');
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to publish template');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await templatesApi.archiveTemplate(id);
      toast.success('Template archived');
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to archive template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await templatesApi.deleteTemplate(id);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete template');
    }
  };

  const handleExportJson = async (tmpl: CMFTemplate) => {
    try {
      const json = await templatesApi.exportTemplateJson(tmpl.id);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `template_${tmpl.code}_v${tmpl.version}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success(`Exported ${tmpl.code} JSON`);
    } catch (err: any) {
      toast.error('Failed to export JSON');
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(importJsonText);
      await templatesApi.importTemplateJson(parsed);
      toast.success('Template imported successfully!');
      setIsImporting(false);
      setImportJsonText('');
      fetchTemplates();
    } catch (err: any) {
      toast.error('Invalid JSON format or import error');
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const code = newTemplateCode.toUpperCase().trim();
      const initialSchema = {
        code,
        name: newTemplateName,
        version: '1.0',
        status: 'DRAFT',
        sections: [
          {
            id: `sec_${Date.now()}`,
            name: 'General Information',
            order: 1,
            groups: [
              {
                id: `grp_${Date.now()}`,
                name: 'Basic Details',
                order: 1,
                fields: [
                  {
                    id: `fld_${Date.now()}`,
                    internalName: 'item_name',
                    label: 'Item Name',
                    type: 'text',
                    required: true,
                  },
                ],
              },
            ],
          },
        ],
      };

      await templatesApi.createTemplate({
        code,
        name: newTemplateName,
        version: '1.0',
        status: 'DRAFT',
        schema_json: initialSchema,
      });

      toast.success(`Template ${code} created`);
      setShowCreateModal(false);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create template');
    }
  };

  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onSave={async (updated) => {
          await templatesApi.updateTemplate(updated.id, {
            name: updated.name,
            description: updated.description,
            status: updated.status,
            schema_json: updated.schema_json,
          });
          fetchTemplates();
          setEditingTemplate(null);
        }}
        onBack={() => setEditingTemplate(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <span>CMF Template Manager</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enterprise low-code template engine. Create, version, preview, and configure CMF K9, K10, K11... forms dynamically.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsImporting(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-border bg-background hover:bg-muted transition-colors"
          >
            <Upload className="h-4 w-4" /> Import JSON
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" /> New Template
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((tmpl) => {
          const statusColors: Record<string, string> = {
            PUBLISHED: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
            DRAFT: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
            ARCHIVED: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
          };

          const sectionsCount = tmpl.sections?.length || tmpl.schema_json?.sections?.length || 0;

          return (
            <div
              key={tmpl.id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-black text-primary">{tmpl.code}</span>
                    <span className="text-xs font-semibold text-muted-foreground">v{tmpl.version}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      statusColors[tmpl.status] || 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {tmpl.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-foreground line-clamp-1">{tmpl.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{tmpl.description || 'No description provided.'}</p>
                <div className="text-[11px] text-muted-foreground font-medium pt-1">
                  Contains <strong className="text-foreground">{sectionsCount}</strong> sections & dynamic groups
                </div>
              </div>

              {/* Card Actions Footer */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(tmpl)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Live Interactive Form Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTemplate(tmpl)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit Template"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(tmpl.id)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Duplicate Template"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportJson(tmpl)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Export JSON"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {tmpl.status === 'DRAFT' && (
                    <button
                      type="button"
                      onClick={() => handlePublish(tmpl.id)}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                    >
                      Publish
                    </button>
                  )}
                  {tmpl.status === 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => handleArchive(tmpl.id)}
                      className="px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
                    >
                      Archive
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(tmpl.id)}
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete Template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Live Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
      )}

      {/* Import JSON Modal */}
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Import Template JSON</h3>
            <p className="text-xs text-muted-foreground">Paste JSON specification for CMF template (K9, K10, K11...)</p>
            <form onSubmit={handleImportSubmit} className="space-y-4">
              <textarea
                rows={12}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder="Paste valid Template JSON here..."
                className="w-full rounded-lg border border-input bg-muted/30 p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsImporting(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                >
                  Import Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Create New CMF Template</h3>
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Template Code</label>
                <input
                  type="text"
                  value={newTemplateCode}
                  onChange={(e) => setNewTemplateCode(e.target.value)}
                  placeholder="e.g. K10"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Template Name</label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g. CMF K10 EV Platform Template"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                >
                  Create Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
