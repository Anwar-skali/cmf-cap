import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTemplate } from '@/context/TemplateContext';
import { DynamicForm } from '@/components/template-engine/DynamicForm';
import { useCreateProjectMutation } from '@/hooks/mutations/useProjectMutations';
import { useAuthStore } from '@/stores/authStore';
import { CrudFormHeader } from '@/components/layout/CrudFormHeader';
import { InputSourcePicker, type InputSourceType } from '@/components/ui/InputSourcePicker';
import { Layers, ShieldAlert, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ProjectNewPage() {
  const navigate = useNavigate();
  const { templates, activeTemplate, setActiveTemplate, isLoading } = useTemplate();
  const createMutation = useCreateProjectMutation();
  const { state: authState } = useAuthStore();
  const currentUser = authState.user;
  const userRole = (currentUser?.role || 'capacity_manager').toLowerCase();
  const isAdmin = userRole === 'admin';
  const isCapacityManager = userRole === 'capacity_manager';

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(activeTemplate?.id || '');
  const [inputSource, setInputSource] = useState<InputSourceType>('manual');

  const currentTemplate =
    templates.find((t) => t.id === selectedTemplateId) || activeTemplate || templates[0];

  const templateCode = currentTemplate?.code?.toUpperCase();
  const isCMFTemplate = templateCode === 'K9' || templateCode === 'K0';
  const canCreateCMF = isCapacityManager || isAdmin;

  // For CMF templates, show Capacity Manager section during creation
  const creationTemplate = isCMFTemplate && currentTemplate
    ? {
        ...currentTemplate,
        sections: currentTemplate.sections?.filter(
          (s) => s.id === 'sec_capacity_manager' || s.name.toLowerCase().includes('capacity')
        ) || [],
      }
    : currentTemplate;

  const handleSave = async (formValues: Record<string, any>) => {
    try {
      if (isCMFTemplate && !canCreateCMF) {
        toast.error(`Only Capacity Managers or Administrators can create CMF ${templateCode} projects`);
        return;
      }

      const name =
        formValues.gst_no ? `CMF ${templateCode} - ${formValues.gst_no}` :
        formValues.capacity ? `CMF ${templateCode} (Cap: ${formValues.capacity})` :
        formValues.project_name ||
        formValues.name ||
        formValues.fld_part_name ||
        `New CMF ${templateCode || ''} Project`.trim();

      const code =
        formValues.gst_no ||
        formValues.unique_id ||
        formValues.line_item ||
        formValues.project_code ||
        formValues.code;

      // Only inject buyer-owned fields (part_name, part_number) when the
      // creator IS a buyer. Injecting them for capacity_manager would
      // prematurely trigger Step 2 in the workflow calculation.
      const isBuyerCreator = userRole === 'buyer';
      const extraBuyerData = isBuyerCreator
        ? { part_name: name, part_number: code }
        : {};

      const payload = {
        name,
        code,
        template_id: currentTemplate?.id,
        template_version: currentTemplate?.version,
        data: {
          ...formValues,
          project_name: name,
          project_code: code,
          ...extraBuyerData,
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
        subtitle="Create a new object for Purchase. Select Manual Input to fill the form, or Import from Excel to upload a file via the Document repository."
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
              Only users with the <strong>Capacity Manager</strong> role or <strong>Administrator</strong> privileges can create CMF {templateCode} projects.
            </p>
          </div>
        </div>
      )}

      {/* White Floating Form Card Container */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card p-6 sm:p-8 shadow-xl space-y-8">

        {/* Input Source Picker — only 2 options: Manual & Excel */}
        <InputSourcePicker
          selectedSource={inputSource}
          onChange={setInputSource}
          title="Choose Input Source"
        />

        {/* Excel → info banner with redirect to Documents page */}
        {inputSource === 'excel' && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-base font-extrabold text-foreground">Excel Import via Document Repository</h4>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                Excel-based project creation is managed through the <strong>Document repository</strong>.
                Upload your <code className="font-mono bg-muted px-1 py-0.5 rounded text-[11px]">.xlsx</code> file
                there and the system will parse and import the direct material objects automatically.
              </p>
            </div>
            <Button
              onClick={() => navigate('/documents')}
              className="shrink-0 bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full px-6 py-2 text-xs shadow-md shadow-blue-500/20 gap-2 cursor-pointer"
            >
              Go to Documents <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Manual form */}
        {inputSource === 'manual' && (
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
        )}
      </div>
    </div>
  );
}
