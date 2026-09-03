import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjectQuery } from '@/hooks/queries/useProjectsQuery';
import { useTemplate } from '@/context/TemplateContext';
import { ProjectMasterTableView } from '@/components/projects/ProjectMasterTableView';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, AlertTriangle, Puzzle, Layers, Sparkles } from 'lucide-react';
import { getStatusVariant } from '@/lib/utils';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { useLanguage } from '@/context/LanguageContext';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useLanguage();
  const { templates, activeTemplate } = useTemplate();

  const { data: project, isLoading, error, refetch } = useProjectQuery(projectId!);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error) return <ErrorState title="Failed to load project" message={error?.message} onRetry={refetch} />;
  if (!project) return <EmptyState title="Project not found" description="The project you are looking for does not exist." />;

  const currentTemplate =
    templates.find((t) => t.id === project.templateId) ||
    activeTemplate ||
    templates[0];

  const templateCode = (currentTemplate?.code || 'K9').toUpperCase();
  const isK0 = templateCode === 'K0';

  // Calculate 4-step workflow lifecycle progression
  const calculateWorkflowStep = (): number => {
    const data = project.data || {};
    const isValSet = (v: any) => v !== undefined && v !== null && String(v).trim() !== '';

    const isGreenEval = (val: any) => {
      if (val === undefined || val === null || String(val).trim() === '') return true;
      const s = String(val).toUpperCase().trim();
      if (s.includes('RED') || s.includes('ORANGE')) return false;
      return true;
    };

    if (isK0) {
      const hasSqd = [
        'quality', 'supply_chain', 'global_purchasing', 'cpl', 'rcpi',
        'minimum_quality_status_acted', 'mass_inquired',
        'packaging_readiness_unlweb_validated', 'tango_contract_validated',
        'supplier_capability_confirmed', 'it_cpl_corail_setting',
        'fcla_validates', 'ple_created', 'edi_opened',
        'um_logistic_flow_validated', 'manufacturing_process_validated',
      ].some((f) => isValSet(data[f]));

      const hasBuyer = [
        'supplier_name', 'vendor_cofor', 'manufacturer_cofor', 'combined_cofor',
        'tango_order', 'ei_status', 'comments', 'coef', 'serial_piece_price',
        'mass_purchase', 'ru', 'noa', 'make_battery_lp_1', 'make_battery_lp_2'
      ].some((f) => isValSet(data[f]));

      const isGreen = isGreenEval(data.quality) && isGreenEval(data.minimum_quality_status_acted);
      if (hasSqd && isGreen && [data.quality, data.minimum_quality_status_acted, data.manufacturing_process_validated].some(isValSet)) return 4;
      if (hasSqd) return 3;
      if (hasBuyer) return 2;
      return 1;
    }

    const hasSqd = [
      'technical_manager', 'k9_sck', 'cat1_forecast_date_cw', 'cat2_forecast_date',
      'cat3_forecast_date', 'cat1_2_3_type', 'weekly_capacity_measured',
      'estimated_target', 'cat_evaluation', 'shared_folder_link', 'comments',
      'sqe', 'sqm', 'team', 'family_multiplier',
    ].some((f) => isValSet(data[f]));

    const hasBuyer = [
      'supplier_info', 'supplier_name', 'manufacturing_cofor', 'production_location',
      'stakeholder', 'buyer', 'apqp', 'use_case', 'part_info'
    ].some((f) => isValSet(data[f]));

    if (hasSqd && isGreenEval(data.cat_evaluation)) return 4;
    if (hasSqd) return 3;
    if (hasBuyer) return 2;
    return 1;
  };

  const currentStep = project.data?.workflow_step ?? calculateWorkflowStep();

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Page Header - Read-Only: No edit/delete actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                <Layers className="h-3 w-3" /> Template {currentTemplate?.code} v{currentTemplate?.version}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">CMF Code: {project.code}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="details">
            <Layers className="mr-2 h-4 w-4" /> CMF {templateCode} Horizontal Matrix
          </TabsTrigger>
          <TabsTrigger value="parts">
            <Puzzle className="mr-2 h-4 w-4" /> Parts ({project.partsCount || 0})
          </TabsTrigger>
          <TabsTrigger value="risks">
            <AlertTriangle className="mr-2 h-4 w-4" /> Risks
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-2 h-4 w-4" /> Documents
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Horizontal Matrix & Workflow Lifecycle */}
        <TabsContent value="details" className="space-y-6">
          {/* Workflow Lifecycle Visual Progress Banner */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                    CMF {templateCode} {t('workflow.lifecycle_title', 'Workflow Lifecycle')}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/30">
                    <Sparkles className="h-3.5 w-3.5" /> 3-Module Lifecycle Progression
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Project created by Capacity Manager, commercial baseline completed by Buyer, evaluated by SQD.
                </p>
              </div>
            </div>

            {/* 4 Steps Visual Progress Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              {/* Step 1 */}
              <div
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                  currentStep >= 1
                    ? 'bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-400'
                    : 'bg-muted/30 border-border text-muted-foreground'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-extrabold text-xs ${
                    currentStep >= 1 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > 1 ? '✓' : '1'}
                </div>
                <div>
                  <p className="text-xs font-bold leading-tight">{t('workflow.step1_capacity', 'Step 1: Capacity')}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">{t('workflow.step1_desc', 'Project Creation & SCR')}</p>
                </div>
              </div>

              {/* Step 2 */}
              <div
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                  currentStep >= 2
                    ? 'bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-400'
                    : 'bg-muted/30 border-border text-muted-foreground'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-extrabold text-xs ${
                    currentStep >= 2 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > 2 ? '✓' : '2'}
                </div>
                <div>
                  <p className="text-xs font-bold leading-tight">{t('workflow.step2_buyer', 'Step 2: Buyer')}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">{t('workflow.step2_desc', 'Commercial & Purchasing')}</p>
                </div>
              </div>

              {/* Step 3 */}
              <div
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                  currentStep >= 3
                    ? 'bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-400'
                    : 'bg-muted/30 border-border text-muted-foreground'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-extrabold text-xs ${
                    currentStep >= 3 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > 3 ? '✓' : '3'}
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
                    ? 'bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-400'
                    : 'bg-muted/30 border-border text-muted-foreground'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-extrabold text-xs ${
                    currentStep === 4 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep === 4 ? '✓' : '4'}
                </div>
                <div>
                  <p className="text-xs font-bold leading-tight">{t('workflow.step4_complete', 'Step 4: Complete')}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">{t('workflow.step4_desc', 'Validated')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pure Horizontal Matrix Master View */}
          <ProjectMasterTableView
            project={project}
            template={currentTemplate}
            templateCode={templateCode}
          />
        </TabsContent>

        <TabsContent value="parts">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Manage specific part components associated with this vehicle line project.</p>
            <Button asChild>
              <Link to={`/projects/${project.id}/parts`}>Open Parts Manager</Link>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="risks">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Manage risk items and mitigation plans for this project.</p>
            <Button asChild>
              <Link to={`/projects/${project.id}/risks`}>Open Risk Register</Link>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Upload and inspect technical specifications and CAD drawings.</p>
            <Button asChild>
              <Link to={`/projects/${project.id}/documents`}>Open Document Repository</Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
