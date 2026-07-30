import React, { useState } from 'react';
import { CMFTemplate, TemplateSection, TemplateField } from '@/types/template';
import { Save, ArrowLeft, Plus, Trash2, Code, Layers, FileCode, Check } from 'lucide-react';
import { toast } from 'sonner';

interface TemplateEditorProps {
  template: CMFTemplate;
  onSave: (updated: CMFTemplate) => Promise<void>;
  onBack: () => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onSave, onBack }) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'json'>('visual');
  const [templateData, setTemplateData] = useState<CMFTemplate>(template);
  const [jsonString, setJsonString] = useState<string>(
    JSON.stringify(template.schema_json || template, null, 2)
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleJsonChange = (val: string) => {
    setJsonString(val);
    try {
      const parsed = JSON.parse(val);
      setJsonError(null);
      setTemplateData((prev) => ({ ...prev, schema_json: parsed, ...parsed }));
    } catch (err: any) {
      setJsonError(err?.message || 'Invalid JSON format');
    }
  };

  const handleAddSection = () => {
    const newSection: TemplateSection = {
      id: `sec_${Date.now()}`,
      name: 'New Section',
      order: (templateData.sections?.length || 0) + 1,
      icon: 'Folder',
      description: 'Section description',
      groups: [
        {
          id: `grp_${Date.now()}`,
          name: 'General Fields',
          order: 1,
          fields: [
            {
              id: `fld_${Date.now()}`,
              internalName: `field_${Date.now()}`,
              label: 'Sample Text Field',
              type: 'text',
              required: false,
              order: 1,
              visible: true,
              editable: true,
            },
          ],
        },
      ],
    };

    const updatedSections = [...(templateData.sections || []), newSection];
    const updated = {
      ...templateData,
      sections: updatedSections,
      schema_json: { ...(templateData.schema_json || templateData), sections: updatedSections },
    };

    setTemplateData(updated);
    setJsonString(JSON.stringify(updated.schema_json || updated, null, 2));
    toast.success('Added new section');
  };

  const handleDeleteSection = (secId: string) => {
    const updatedSections = templateData.sections?.filter((s) => s.id !== secId) || [];
    const updated = {
      ...templateData,
      sections: updatedSections,
      schema_json: { ...(templateData.schema_json || templateData), sections: updatedSections },
    };

    setTemplateData(updated);
    setJsonString(JSON.stringify(updated.schema_json || updated, null, 2));
    toast.success('Deleted section');
  };

  const handleSaveClick = async () => {
    if (jsonError) {
      toast.error('Cannot save invalid JSON structure');
      return;
    }

    try {
      setIsSaving(true);
      await onSave(templateData);
      toast.success('Template saved successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Editor Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Editing Template: {templateData.name} ({templateData.code})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Version {templateData.version} • Status {templateData.status}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex items-center rounded-lg bg-muted p-1 border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'visual'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Visual Builder</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('json')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'json'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              <span>JSON Schema</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isSaving || !!jsonError}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save Template'}</span>
          </button>
        </div>
      </div>

      {/* Editor Content Tabs */}
      {activeTab === 'visual' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground">Template Sections ({templateData.sections?.length || 0})</h3>
            <button
              type="button"
              onClick={handleAddSection}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Section
            </button>
          </div>

          {templateData.sections?.map((sec, idx) => (
            <div key={sec.id} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={sec.name}
                    onChange={(e) => {
                      const newSecs = [...(templateData.sections || [])];
                      newSecs[idx].name = e.target.value;
                      setTemplateData({ ...templateData, sections: newSecs });
                    }}
                    className="font-bold text-base text-foreground bg-transparent border-b border-transparent hover:border-input focus:border-primary focus:outline-none px-1 py-0.5 rounded"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteSection(sec.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Groups List */}
              <div className="space-y-3 pl-4">
                {sec.groups?.map((grp) => (
                  <div key={grp.id} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{grp.name}</span>
                      <span className="text-[10px] text-muted-foreground">{grp.fields?.length || 0} fields</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {grp.fields?.map((fld) => (
                        <span
                          key={fld.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-background border border-border text-[11px] font-medium"
                        >
                          <span className="font-mono text-primary font-bold">{fld.internalName}</span>
                          <span className="text-muted-foreground">({fld.type})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* JSON Code Editor Tab */
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground flex items-center gap-2">
              <FileCode className="h-4 w-4 text-primary" />
              <span>Raw JSON Template Specification</span>
            </label>
            {jsonError ? (
              <span className="text-xs font-semibold text-destructive">{jsonError}</span>
            ) : (
              <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Valid JSON
              </span>
            )}
          </div>

          <textarea
            rows={24}
            value={jsonString}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="w-full rounded-lg border border-input bg-muted/30 p-4 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
          />
        </div>
      )}
    </div>
  );
};
