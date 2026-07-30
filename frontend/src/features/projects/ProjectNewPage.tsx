import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTemplate } from '@/context/TemplateContext';
import { DynamicForm } from '@/components/template-engine/DynamicForm';
import { useCreateProjectMutation } from '@/hooks/mutations/useProjectMutations';
import { useAuthStore } from '@/stores/authStore';
import { CrudFormHeader } from '@/components/layout/CrudFormHeader';
import { InputSourcePicker, InputSourceType } from '@/components/ui/InputSourcePicker';
import { Layers, ShieldAlert, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectNewPage() {
  const navigate = useNavigate();
  const { templates, activeTemplate, setActiveTemplate, isLoading } = useTemplate();
  const createMutation = useCreateProjectMutation();
  const { state: authState } = useAuthStore();
  const currentUser = authState.user;
  const userRole = (currentUser?.role || 'buyer').toLowerCase();
  const isAdmin = userRole === 'admin';
  const isBuyer = userRole === 'buyer';

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(activeTemplate?.id || '');
  const [inputSource, setInputSource] = useState<InputSourceType>('manual');

  const currentTemplate =
    templates.find((t) => t.id === selectedTemplateId) || activeTemplate || templates[0];

  const templateCode = currentTemplate?.code?.toUpperCase();
  const isCMFTemplate = templateCode === 'K9' || templateCode === 'K0';
  const canCreateCMF = isBuyer || isAdmin;

  // For CMF templates, only show Buyer section during creation
  const creationTemplate = isCMFTemplate && currentTemplate
    ? {
        ...currentTemplate,
        sections: currentTemplate.sections?.filter(
          (s) => s.id === 'sec_buyer' || s.name.toLowerCase().includes('buyer')
        ) || [],
      }
    : currentTemplate;

  const handleSave = async (formValues: Record<string, any>) => {
    try {
      if (isCMFTemplate && !canCreateCMF) {
        toast.error(`Only Buyers or Administrators can create CMF ${templateCode} projects`);
        return;
      }

      // K0 uses part_name; K9 uses part_name too. Code: K0 uses part_number/line_item, K9 uses unique_id
      const name =
        formValues.part_name ||
        formValues.project_name ||
        formValues.name ||
        'New CMF Project';
      const code =
        formValues.unique_id ||
        formValues.part_number ||
        formValues.line_item ||
        formValues.project_code ||
        formValues.code;

      const payload = {
        name,
        code,
        template_id: currentTemplate?.id,
        template_version: currentTemplate?.version,
        data: {
          ...formValues,
          template_code: currentTemplate?.code,
          creation_source: inputSource,
        },
      };

      createMutation.mutate(payload as any, {
        onSuccess: (prj) => {
          toast.success(`CMF ${templateCode} Project created successfully!`);
          navigate(`/projects/${prj.id}`);
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to create project');
        },
      });
    } catch (err: any) {
      toast.error(err?.message || 'Error saving project');
    }
  };

  if (isLoading || !currentTemplate) {
    return (
      <div className="flex h-64 items-center justify-center space-y-3 flex-col">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm text-muted-foreground font-semibold">Loading Template Engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* LTOS Dark Hero Header Banner */}
      <CrudFormHeader
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Direct Materials', href: '/projects' },
          { label: 'Create Object' },
        ]}
        title={`Create Direct Material Object (${currentTemplate.code})`}
        subtitle="Create a new object for Purchase. You can either upload a CSV file with data or manually enter the values."
        versionBadge={`Latest validated LTP version: V${currentTemplate.version || '20260629_V5'}`}
        extraActions={
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3.5 py-1.5 rounded-full text-xs text-slate-200">
            <Layers className="h-4 w-4 text-blue-400 shrink-0" />
            <span className="font-semibold text-slate-400">Template:</span>
            <select
              value={currentTemplate.id}
              onChange={(e) => {
                const selected = templates.find((t) => t.id === e.target.value);
                if (selected) {
                  setSelectedTemplateId(selected.id);
                  setActiveTemplate(selected);
                }
              }}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                  Template {t.code} v{t.version} ({t.status})
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Permission Warning */}
      {isCMFTemplate && !canCreateCMF && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm font-semibold">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Restricted Operation</p>
            <p className="text-xs font-normal opacity-90">
              Only users with the <strong>Buyer</strong> role or <strong>Administrator</strong> privileges can create CMF {templateCode} projects.
            </p>
          </div>
        </div>
      )}

      {/* White Floating Form Card Container */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card p-6 sm:p-8 shadow-xl space-y-8">
        {/* Choose Input Source 2x2 Picker Grid */}
        <InputSourcePicker
          selectedSource={inputSource}
          onChange={setInputSource}
          title="Choose Input Source"
        />

        {/* CSV Dropzone view if CSV selected */}
        {inputSource === 'csv' && (
          <div className="rounded-2xl border-2 border-dashed border-blue-500/40 bg-blue-50/20 dark:bg-blue-950/20 p-8 text-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 mx-auto">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-foreground">Upload CSV File</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Select a standard .csv or .xlsx file containing direct material object attributes.
              </p>
            </div>
            <input
              type="file"
              accept=".csv,.xlsx"
              id="csv-upload-input"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  toast.success(`File "${e.target.files[0].name}" attached for import`);
                }
              }}
            />
            <label
              htmlFor="csv-upload-input"
              className="inline-flex items-center justify-center rounded-full bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-bold px-6 py-2 transition-colors cursor-pointer shadow-sm"
            >
              Browse CSV File
            </label>
          </div>
        )}

        {/* Manual or Form Fill Input */}
        <div className="pt-2">
          <DynamicForm
            template={creationTemplate}
            onSave={handleSave}
            isSaving={createMutation.isPending}
            userRole={userRole}
            readOnly={isCMFTemplate && !canCreateCMF}
            title={`Enter Details (${currentTemplate.name})`}
            onCancel={() => navigate('/projects')}
          />
        </div>
      </div>
    </div>
  );
}
