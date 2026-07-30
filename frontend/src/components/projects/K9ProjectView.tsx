import React, { useState, useEffect } from 'react';
import { CMFTemplate, TemplateSection } from '@/types/template';
import { FieldRenderer } from '@/components/template-engine/fields/FieldRenderer';
import { useAuthStore } from '@/stores/authStore';
import { useLanguage } from '@/context/LanguageContext';
import { ProjectMasterTableView } from './ProjectMasterTableView';
import {
  UserCheck,
  Building2,
  Award,
  CheckCircle2,
  Lock,
  Save,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Table as TableIcon,
  FormInput,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface K9ProjectViewProps {
  project: any;
  template: CMFTemplate;
  templateCode?: string;
  onSave: (values: Record<string, any>) => void | Promise<void>;
  isSaving?: boolean;
  initialMode?: 'master_table' | 'role_forms';
}

export const K9ProjectView: React.FC<K9ProjectViewProps> = ({
  project,
  template,
  templateCode,
  onSave,
  isSaving = false,
  initialMode = 'master_table',
}) => {
  const { t } = useLanguage();
  const { state: authState } = useAuthStore();
  const currentUser = authState.user;
  const userRole = (currentUser?.role || 'buyer').toLowerCase();
  const isAdmin = userRole === 'admin';

  const activeTemplateCode = (templateCode || template?.code || 'K9').toUpperCase();
  const isK0 = activeTemplateCode === 'K0';

  const getInitialValues = () => {
    const base = project.data || {};
    if (isK0) {
      return {
        cat_rating: 'GREEN',
        part_name: base.part_name ?? project.name,
        part_number: base.part_number ?? project.code,
        ...base,
      };
    }
    return {
      cat_evaluation: 'GREEN',
      unique_id: base.unique_id ?? project.code,
      part_name: base.part_name ?? project.name,
      ...base,
    };
  };

  const getInitialTab = (): 'buyer' | 'capacity_manager' | 'sqd' => {
    if (userRole === 'capacity_manager') return 'capacity_manager';
    if (userRole === 'sqd') return 'sqd';
    return 'buyer';
  };

  const [mainMode, setMainMode] = useState<'master_table' | 'role_forms'>(initialMode);
  const [formValues, setFormValues] = useState<Record<string, any>>(getInitialValues);
  const [activeTab, setActiveTab] = useState<'buyer' | 'capacity_manager' | 'sqd'>(getInitialTab);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    if (userRole === 'capacity_manager') setActiveTab('capacity_manager');
    else if (userRole === 'sqd') setActiveTab('sqd');
    else setActiveTab('buyer');
  }, [userRole]);

  // Sync formValues whenever project.data is refreshed (e.g. after a successful save + refetch).
  // This ensures calculateWorkflowStep sees the latest merged data from the backend.
  useEffect(() => {
    setFormValues(getInitialValues());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.data]);

  const calculateWorkflowStep = (): number => {
    const data = formValues;
    const isValSet = (v: any) => v !== undefined && v !== null && String(v).trim() !== '';

    const isGreenEval = (val: any) => {
      if (val === undefined || val === null || String(val).trim() === '') return true;
      const s = String(val).toUpperCase().trim();
      if (s.includes('RED') || s.includes('ORANGE')) return false;
      return true;
    };

    if (isK0) {
      const hasSqd = [
        'sqvl', 'sqme_manufacturing', 'apqp_grid', 'run_assessment',
        'cat_forecast_date', 'cat_forecast_calendar_week', 'cat_real_date',
        'cat_real_calendar_week', 'last_cat', 'requested_supplier_weekly_capacity',
        'cat_run_observation', 'number_production_days', 'number_production_shifts',
        'cat_rating', 'cat_link', 'cat_comment'
      ].some(f => isValSet(data[f]));

      const hasCap = [
        'quantity_parts_per_vehicle', 'weekly_capacity_requested_gst',
        'capacity_step_requested_gst', 'calculation_date_gst', 'weekly_capacity_requested_tko',
        'capacity_step_requested_tko', 'scr_date_tko', 'scr_tko_link',
        'weekly_capacity_latest_ltos', 'capacity_step_latest_ltos', 'date_latest_ltos',
        'calculation_link', 'contracted_capacity', 'contracted_capacity_step',
        'capacity_sizing_ok', 'new_scr_calculation_done', 'contracted_capacity_ok',
        'capacity_comments', 'capacity_workshop_date', 'capacity_workshop_comment'
      ].some(f => isValSet(data[f]));

      if (hasSqd && isGreenEval(data.cat_rating)) return 4;
      if (hasSqd) return 3;
      if (hasCap) return 2;
      return 1;
    }

    const hasSqd = [
      'technical_manager', 'k9_sck', 'cat1_forecast_date_cw', 'cat2_forecast_date',
      'cat3_forecast_date', 'cat1_2_3_type', 'weekly_capacity_measured',
      'estimated_target', 'cat_evaluation', 'shared_folder_link', 'comments',
      'sqe', 'sqm', 'team', 'family_multiplier'
    ].some(f => isValSet(data[f]));

    const hasCap = [
      'capacity', 'scr_link_docinfo', 'gst_no', 'contracted_capacity',
      'fete', 'tko_fete_link_sharepoint', 'capacity_standard', 'fete_tko_letter_doc'
    ].some(f => isValSet(data[f]));

    if (hasSqd && isGreenEval(data.cat_evaluation)) return 4;
    if (hasSqd) return 3;
    if (hasCap) return 2;
    return 1;
  };

  const currentStep = project.data?.workflow_step ?? calculateWorkflowStep();

  const buyerSection = template.sections?.find((s) => s.id === 'sec_buyer' || s.name.toLowerCase().includes('buyer'));
  const capacitySection = template.sections?.find(
    (s) => s.id === 'sec_capacity_manager' || s.name.toLowerCase().includes('capacity')
  );
  const sqdSection = template.sections?.find((s) => s.id === 'sec_sqd' || s.name.toLowerCase().includes('sqd'));

  const canEditBuyer = isAdmin || userRole === 'buyer';
  const canEditCapacity = isAdmin || userRole === 'capacity_manager';
  const canEditSqd = isAdmin || userRole === 'sqd';

  const canEditActiveTab =
    (activeTab === 'buyer' && canEditBuyer) ||
    (activeTab === 'capacity_manager' && canEditCapacity) ||
    (activeTab === 'sqd' && canEditSqd);

  const handleFieldChange = (internalName: string, val: any) => {
    setIsDirty(true);
    setFormValues((prev) => ({ ...prev, [internalName]: val }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let sectionToSave: TemplateSection | undefined;
    if (activeTab === 'buyer') sectionToSave = buyerSection;
    if (activeTab === 'capacity_manager') sectionToSave = capacitySection;
    if (activeTab === 'sqd') sectionToSave = sqdSection;

    const fieldsToSubmit: Record<string, any> = {};
    sectionToSave?.groups?.forEach((group) => {
      group.fields?.forEach((field) => {
        const val = formValues[field.internalName];
        if (val !== undefined) {
          fieldsToSubmit[field.internalName] = val;
        }
      });
    });

    await onSave(fieldsToSubmit);
    setIsDirty(false);
    setLastSaved(new Date().toLocaleTimeString());
  };

  const renderSectionGroups = (section: TemplateSection | undefined, isTabEditable: boolean) => {
    if (!section) {
      return (
        <div className="p-8 text-center text-muted-foreground text-xs">
          No field definitions configured for this section.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {section.groups?.map((group) => (
          <div
            key={group.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4 transition-all duration-200"
          >
            <div className="border-b border-border/60 pb-2.5 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold tracking-wider uppercase text-foreground flex items-center gap-2">
                  <span>{group.name}</span>
                </h3>
                {group.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
                )}
              </div>
              <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                {group.fields?.length || 0} fields
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {group.fields?.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={formValues[field.internalName]}
                  onChange={(val) => handleFieldChange(field.internalName, val)}
                  disabled={!isTabEditable}
                  formValues={formValues}
                  userRole={userRole}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6 pb-20">
      {/* Workflow Lifecycle Visual Banner */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                CMF {activeTemplateCode} {t('workflow.lifecycle_title', 'Workflow Lifecycle')}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/30">
                <Sparkles className="h-3.5 w-3.5" /> {t('workflow.module_architecture', '3-Module Role Architecture')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Project baseline created by Buyer, capacity planned by Capacity Manager, evaluated by SQD.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-slate-300 dark:border-slate-700 p-0.5 bg-card shadow-xs">
              <button
                type="button"
                onClick={() => setMainMode('master_table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  mainMode === 'master_table' ? 'bg-blue-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" /> Full Master Table View
              </button>
              <button
                type="button"
                onClick={() => setMainMode('role_forms')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  mainMode === 'role_forms' ? 'bg-blue-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FormInput className="h-3.5 w-3.5" /> Edit by Role Module
              </button>
            </div>

            <div className="flex items-center gap-2 bg-muted/40 px-3.5 py-1.5 rounded-xl border border-border">
              <span className="text-xs font-medium text-muted-foreground">{t('header.active_role', 'Active Role')}:</span>
              <span className="text-xs font-bold text-primary capitalize px-2 py-0.5 rounded-md bg-primary/10">
                {userRole.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Steps Visual Progress Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          {/* Step 1 */}
          <div
            className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
              currentStep >= 1
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-muted/30 border-border text-muted-foreground'
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-extrabold text-xs ${
                currentStep >= 1 ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              1
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">{t('workflow.step1_buyer', 'Step 1: Buyer')}</p>
              <p className="text-[11px] opacity-80 mt-0.5">{t('workflow.step1_desc', 'Project Creation')}</p>
            </div>
          </div>

          {/* Step 2 */}
          <div
            className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
              currentStep >= 2
                ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400'
                : 'bg-muted/30 border-border text-muted-foreground'
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-extrabold text-xs ${
                currentStep >= 2 ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              2
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">{t('workflow.step2_capacity', 'Step 2: Capacity')}</p>
              <p className="text-[11px] opacity-80 mt-0.5">{t('workflow.step2_desc', 'Planning & SCR')}</p>
            </div>
          </div>

          {/* Step 3 */}
          <div
            className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
              currentStep >= 3
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                : 'bg-muted/30 border-border text-muted-foreground'
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-extrabold text-xs ${
                currentStep >= 3 ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              3
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">{t('workflow.step3_sqd', 'Step 3: SQD')}</p>
              <p className="text-[11px] opacity-80 mt-0.5">{t('workflow.step3_desc', 'CAT Evaluation')}</p>
            </div>
          </div>

          {/* Step 4 */}
          <div
            className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
              currentStep === 4
                ? 'bg-purple-500/10 border-purple-500/40 text-purple-600 dark:text-purple-400'
                : 'bg-muted/30 border-border text-muted-foreground'
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-extrabold text-xs ${
                currentStep === 4 ? 'bg-purple-500 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              4
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">{t('workflow.step4_complete', 'Step 4: Complete')}</p>
              <p className="text-[11px] opacity-80 mt-0.5">{t('workflow.step4_desc', 'Validated')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main View Mode Render */}
      {mainMode === 'master_table' ? (
        <ProjectMasterTableView
          project={project}
          template={template}
          templateCode={activeTemplateCode}
          onSave={onSave}
          isSaving={isSaving}
          userRole={userRole}
        />
      ) : (
      <div className="space-y-4">
        <div className="flex border-b border-border space-x-2">
          {/* Buyer Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('buyer')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'buyer'
                ? 'border-primary text-primary bg-primary/10 rounded-t-xl'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-card rounded-t-xl'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>{t('workflow.tab_buyer', '1. Buyer')}</span>
            {!canEditBuyer && <Lock className="h-3.5 w-3.5 text-amber-500 ml-1" />}
          </button>

          {/* Capacity Manager Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('capacity_manager')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'capacity_manager'
                ? 'border-primary text-primary bg-primary/10 rounded-t-xl'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-card rounded-t-xl'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>{t('workflow.tab_capacity', '2. Capacity Manager')}</span>
            {!canEditCapacity && <Lock className="h-3.5 w-3.5 text-amber-500 ml-1" />}
          </button>

          {/* SQD Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('sqd')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'sqd'
                ? 'border-primary text-primary bg-primary/10 rounded-t-xl'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-card rounded-t-xl'
            }`}
          >
            <Award className="h-4 w-4" />
            <span>{t('workflow.tab_sqd', '3. SQD Team')}</span>
            {!canEditSqd && <Lock className="h-3.5 w-3.5 text-amber-500 ml-1" />}
          </button>
        </div>

        {/* Tab Content Container */}
        <AnimatePresence mode="wait">
          {activeTab === 'buyer' && (
            <motion.div
              key="tab-buyer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {!canEditBuyer && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>{t('workflow.readonly_buyer', 'Read-Only Section. Only users with the Buyer role or Administrators can edit Buyer fields.')}</span>
                </div>
              )}

              {renderSectionGroups(buyerSection, canEditBuyer)}
            </motion.div>
          )}

          {activeTab === 'capacity_manager' && (
            <motion.div
              key="tab-capacity"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {!canEditCapacity && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>{t('workflow.readonly_capacity', 'Read-Only Section. Only users with the Capacity Manager role or Administrators can edit Capacity fields.')}</span>
                </div>
              )}

              {renderSectionGroups(capacitySection, canEditCapacity)}
            </motion.div>
          )}

          {activeTab === 'sqd' && (
            <motion.div
              key="tab-sqd"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {!canEditSqd && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>{t('workflow.readonly_sqd', 'Read-Only Section. Only users with the SQD role or Administrators can edit SQD fields.')}</span>
                </div>
              )}

              {renderSectionGroups(sqdSection, canEditSqd)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* Sticky Action Footer Bar */}
      {mainMode === 'role_forms' && canEditActiveTab && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-4xl rounded-2xl border border-border bg-card/95 backdrop-blur-md p-3 px-6 shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDirty ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                <AlertCircle className="h-4 w-4" /> {t('workflow.unsaved_changes', 'Unsaved changes in section')} ({activeTab.replace('_', ' ')})
              </span>
            ) : lastSaved ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                <CheckCircle2 className="h-4 w-4" /> {t('workflow.saved_at', 'Saved at')} {lastSaved}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Editing permitted for your role</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormValues(getInitialValues())}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" /> {t('workflow.reset', 'Reset')}
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all cursor-pointer focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isSaving ? 'Saving...' : `${t('workflow.save_section', 'Save Section')} (${activeTemplateCode})`}</span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
};
