import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTemplate } from '@/context/TemplateContext';
import { CMFTemplate, TemplateField } from '@/types/template';
import { Project } from '@/types';
import { getProjects, createProject } from '@/api/endpoints/projects';
import { DynamicForm } from '@/components/template-engine/DynamicForm';
import { ImportWizard } from '@/features/import/ImportWizard';
import { StructureImportWizard } from '@/features/templates/StructureImportWizard';
import { CrudFormHeader } from '@/components/layout/CrudFormHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Layers,
  Search,
  CheckCircle2,
  Download,
  PlusCircle,
  ShoppingBag,
  Gauge,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Code2,
  Filter,
  Copy,
  FolderKanban,
  FileSpreadsheet,
  X,
  ExternalLink,
  RefreshCw,
  LayoutTemplate,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { templatesApi } from '@/api/templates';

export default function TemplateStudioPage() {
  const navigate = useNavigate();
  const { templates, activeTemplate, setActiveTemplate, isLoading: isTemplatesLoading, fetchTemplates } = useTemplate();

  // Selected Structure state (driven dynamically by DB templates)
  const [selectedStructureId, setSelectedStructureId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'repository' | 'projects' | 'explorer' | 'matrix' | 'json'>('repository');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'ALL' | 'buyer' | 'capacity' | 'sqd'>('ALL');
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('ALL');

  // Projects under selected structure state
  const [structureProjects, setStructureProjects] = useState<Project[]>([]);
  const [totalProjectsCount, setTotalProjectsCount] = useState<number>(0);
  const [isProjectsLoading, setIsProjectsLoading] = useState<boolean>(false);

  // Modals for Manual Creation and Import Pipeline
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [isCreatingProject, setIsCreatingProject] = useState<boolean>(false);

  // Modals for Project STRUCTURE creation/import (Pipeline A — no project record)
  const [showStructureWizard, setShowStructureWizard] = useState<boolean>(false);
  const [structureWizardMode, setStructureWizardMode] = useState<'excel' | 'json' | 'manual'>('excel');

  // Delete structure state
  const [structureToDelete, setStructureToDelete] = useState<CMFTemplate | null>(null);
  const [isDeletingStructure, setIsDeletingStructure] = useState<boolean>(false);

  const handleDeleteStructure = async () => {
    if (!structureToDelete) return;
    setIsDeletingStructure(true);
    try {
      await templatesApi.deleteTemplate(structureToDelete.id);
      toast.success(`Project Structure "${structureToDelete.name}" deleted successfully!`);
      const deletedId = structureToDelete.id;
      setStructureToDelete(null);
      await fetchTemplates();
      if (selectedStructureId === deletedId) {
        const remaining = templates.filter((t) => t.id !== deletedId);
        if (remaining.length > 0) {
          setSelectedStructureId(remaining[0].id);
          setActiveTemplate(remaining[0]);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete Project Structure.');
    } finally {
      setIsDeletingStructure(false);
    }
  };

  // Sync selected structure when templates load or change
  useEffect(() => {
    if (templates.length > 0) {
      if (!selectedStructureId) {
        const initial = activeTemplate || templates[0];
        setSelectedStructureId(initial.id);
      }
    }
  }, [templates, activeTemplate, selectedStructureId]);

  const selectedStructure: CMFTemplate | undefined =
    templates.find((t) => t.id === selectedStructureId) || activeTemplate || templates[0];

  // Fetch projects belonging to selected structure
  const fetchStructureProjects = useCallback(async () => {
    if (!selectedStructure?.id) return;
    setIsProjectsLoading(true);
    try {
      const res = await getProjects({
        template_id: selectedStructure.id,
        search: projectSearchQuery || undefined,
        status: projectStatusFilter !== 'ALL' ? (projectStatusFilter as any) : undefined,
        pageSize: 100,
      });
      setStructureProjects(res.items || []);
      setTotalProjectsCount(res.total || res.items?.length || 0);
    } catch (err: any) {
      console.error('Failed to load projects for structure:', err);
      toast.error('Failed to fetch projects for selected structure.');
    } finally {
      setIsProjectsLoading(false);
    }
  }, [selectedStructure?.id, projectSearchQuery, projectStatusFilter]);

  useEffect(() => {
    if (selectedStructure?.id) {
      fetchStructureProjects();
    }
  }, [selectedStructure?.id, fetchStructureProjects]);

  // Handle Manual Project Creation save
  const handleSaveManualProject = async (formValues: Record<string, any>) => {
    if (!selectedStructure) {
      toast.error('No Project Structure selected.');
      return;
    }
    setIsCreatingProject(true);
    try {
      const name =
        formValues.part_name ||
        formValues.project_name ||
        formValues.name ||
        `Project (${selectedStructure.code})`;
      const code =
        formValues.unique_id ||
        formValues.part_number ||
        formValues.line_item ||
        formValues.project_code ||
        formValues.code;

      const payload = {
        name,
        code,
        template_id: selectedStructure.id,
        template_version: selectedStructure.version,
        data: {
          ...formValues,
          template_code: selectedStructure.code,
          creation_source: 'manual_templates_page',
        },
      };

      const created = await createProject(payload as any);
      toast.success(`Project "${created.name}" created under ${selectedStructure.code}!`);
      setShowManualModal(false);
      fetchStructureProjects();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create project.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Export & Copy JSON helpers
  const handleExportJson = (tmpl: CMFTemplate) => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tmpl, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `cmf_template_${tmpl.code.toLowerCase()}_v${tmpl.version}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success(`Exported CMF ${tmpl.code} JSON schema!`);
    } catch {
      toast.error('Failed to export JSON');
    }
  };

  const handleCopyJson = (tmpl: CMFTemplate) => {
    navigator.clipboard.writeText(JSON.stringify(tmpl, null, 2));
    toast.success(`Copied CMF ${tmpl.code} JSON schema to clipboard!`);
  };

  // Collect all fields across all templates for Field Schema Explorer
  const allFieldsWithMeta: Array<{
    templateCode: string;
    sectionName: string;
    sectionId: string;
    groupName: string;
    field: TemplateField;
  }> = [];

  templates.forEach((tmpl) => {
    tmpl?.sections?.forEach((sec) => {
      sec.groups?.forEach((grp) => {
        grp.fields?.forEach((fld) => {
          allFieldsWithMeta.push({
            templateCode: tmpl.code,
            sectionName: sec.name,
            sectionId: sec.id,
            groupName: grp.name,
            field: fld,
          });
        });
      });
    });
  });

  const filteredFields = allFieldsWithMeta.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.field.internalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.groupName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      selectedRoleFilter === 'ALL' ||
      (selectedRoleFilter === 'buyer' && item.sectionId.includes('buyer')) ||
      (selectedRoleFilter === 'capacity' && item.sectionId.includes('capacity')) ||
      (selectedRoleFilter === 'sqd' && item.sectionId.includes('sqd'));

    return matchesSearch && matchesRole;
  });

  if (isTemplatesLoading) {
    return (
      <div className="flex h-64 items-center justify-center space-y-3 flex-col">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm font-semibold text-muted-foreground">Loading CMF Project Structures...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Top LTOS Hero Banner */}
      <CrudFormHeader
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Resources', href: '/documents' },
          { label: 'Project Structures & Templates' },
        ]}
        title="Project Structures & Schema Repository"
        subtitle="Central management entry point for Project Structure definitions, schemas, validation rules, manual creation, and AI Excel import pipelines."
        versionBadge="CMF Structure Engine v2.0"
        extraActions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                if (selectedStructure) setActiveTemplate(selectedStructure);
                setShowManualModal(true);
              }}
              size="sm"
              className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full px-4 py-2 text-xs shadow-md shadow-blue-500/20 gap-1.5 cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" /> Create Project
            </Button>
            <Button
              onClick={() => {
                if (selectedStructure) setActiveTemplate(selectedStructure);
                setShowImportModal(true);
              }}
              size="sm"
              variant="outline"
              className="bg-card hover:bg-accent border-slate-300 dark:border-slate-700 text-foreground font-bold rounded-full px-4 py-2 text-xs shadow-sm gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Import Projects
            </Button>
            <Button
              onClick={() => {
                setStructureWizardMode('excel');
                setShowStructureWizard(true);
              }}
              size="sm"
              variant="outline"
              className="bg-card hover:bg-accent border-slate-300 dark:border-slate-700 text-foreground font-bold rounded-full px-4 py-2 text-xs shadow-sm gap-1.5 cursor-pointer"
              title="Create a brand-new Project Structure from an Excel file, JSON schema, or manually — no project record is created."
            >
              <LayoutTemplate className="h-4 w-4 text-violet-500" /> Create Structure
            </Button>
            <Button
              onClick={() => {
                setStructureWizardMode('json');
                setShowStructureWizard(true);
              }}
              size="sm"
              variant="outline"
              className="bg-card hover:bg-accent border-slate-300 dark:border-slate-700 text-foreground font-bold rounded-full px-4 py-2 text-xs shadow-sm gap-1.5 cursor-pointer"
              title="Import an existing Project Structure from JSON schema or Excel workbook."
            >
              <Code2 className="h-4 w-4 text-sky-500" /> Import Structure
            </Button>
          </div>
        }
      />

      {/* Global Structure Selection Header Bar */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card p-4 sm:p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-12 min-w-12 max-w-36 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 font-black border border-blue-500/20 px-2 shrink-0 truncate text-xs sm:text-sm">
            {selectedStructure?.code || 'ST'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-foreground">{selectedStructure?.name || 'Select Structure'}</h2>
              <Badge variant="outline" className="border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full px-2.5 py-0.5">
                v{selectedStructure?.version || '1.0'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {selectedStructure?.description || 'Selected Project Structure source of truth.'}
            </p>
          </div>
        </div>

        {/* Structure Picker Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Structure:</span>
          <select
            value={selectedStructure?.id || ''}
            onChange={(e) => {
              const found = templates.find((t) => t.id === e.target.value);
              if (found) {
                setSelectedStructureId(found.id);
                setActiveTemplate(found);
              }
            }}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-foreground font-extrabold text-xs rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name} (v{t.version})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('repository')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'repository'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-card text-muted-foreground hover:bg-accent border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> 1. Structures Overview
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer relative ${
              activeTab === 'projects'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-card text-muted-foreground hover:bg-accent border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FolderKanban className="h-3.5 w-3.5" /> 2. Projects in {selectedStructure?.code} ({totalProjectsCount})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('explorer')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'explorer'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-card text-muted-foreground hover:bg-accent border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" /> 3. Field Schema Explorer ({allFieldsWithMeta.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-card text-muted-foreground hover:bg-accent border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> 4. Structure Comparison
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'json'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-card text-muted-foreground hover:bg-accent border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5" /> 5. JSON Schema Code
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: STRUCTURES OVERVIEW */}
      {activeTab === 'repository' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {templates.map((tmpl) => {
              const isSelected = tmpl.id === selectedStructure?.id;
              return (
                <div
                  key={tmpl.id}
                  className={`rounded-3xl border ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800'
                  } bg-card p-6 sm:p-8 shadow-xl space-y-6 flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/40 transition-all`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-12 min-w-12 max-w-36 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 font-black border border-blue-500/20 px-2 shrink-0 truncate text-xs sm:text-sm">
                          {tmpl.code}
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-xl font-extrabold text-foreground truncate">{tmpl.name}</h2>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            Code: {tmpl.code} • Version {tmpl.version}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full px-3 py-1 shrink-0"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {tmpl.status || 'Published Standard'}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {tmpl.description ||
                        `Standard CMF ${tmpl.code} project template structure defining field validation rules, schemas, and 3-role workflow requirements.`}
                    </p>

                    {/* Section Breakdown Preview */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                        Module Sections ({tmpl.sections?.length || 0})
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {tmpl.sections && tmpl.sections.length > 0 ? (
                          tmpl.sections.slice(0, 3).map((sec, idx) => (
                            <div
                              key={sec.id || idx}
                              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 space-y-1"
                            >
                              <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs">
                                {idx === 0 && <ShoppingBag className="h-3.5 w-3.5" />}
                                {idx === 1 && <Gauge className="h-3.5 w-3.5" />}
                                {idx === 2 && <ShieldCheck className="h-3.5 w-3.5" />}
                                {idx + 1}. {sec.name}
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                {sec.groups?.reduce((acc, g) => acc + (g.fields?.length || 0), 0) || 0} fields
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 text-xs text-muted-foreground">
                            Standard single-module schema
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        onClick={() => {
                          setSelectedStructureId(tmpl.id);
                          setActiveTemplate(tmpl);
                          setActiveTab('projects');
                        }}
                        variant="outline"
                        size="sm"
                        className="rounded-full text-xs font-bold gap-1.5 border-slate-300 dark:border-slate-700"
                      >
                        <FolderKanban className="h-3.5 w-3.5 text-blue-600" /> View Projects
                      </Button>
                      <Button
                        onClick={() => handleExportJson(tmpl)}
                        variant="outline"
                        size="sm"
                        className="rounded-full text-xs font-bold gap-1.5 border-slate-300 dark:border-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" /> JSON
                      </Button>
                      {['K0', 'K9'].includes(tmpl.code?.toUpperCase?.() ?? '') ? (
                        <span
                          title="Protected Core Structure – cannot be deleted"
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 select-none cursor-not-allowed"
                        >
                          🔒 Protected
                        </span>
                      ) : (
                        <Button
                          onClick={() => setStructureToDelete(tmpl)}
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs font-bold gap-1.5 border-rose-200 dark:border-rose-900/50 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Delete Structure"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" /> Delete
                        </Button>
                      )}
                    </div>

                    <Button
                      onClick={() => {
                        setSelectedStructureId(tmpl.id);
                        setActiveTemplate(tmpl);
                        setShowManualModal(true);
                      }}
                      size="sm"
                      className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full px-4 py-2 text-xs shadow-md shadow-blue-500/20 gap-1.5 cursor-pointer"
                    >
                      Create Project <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: PROJECTS IN SELECTED STRUCTURE */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          {/* Header Actions & Filter Bar */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card p-6 shadow-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FolderKanban className="h-5 w-5 text-blue-600" />
                  Projects Belonging to Structure: <span className="text-blue-600">{selectedStructure?.name}</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Listing all projects created manually or imported into this Project Structure.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={() => setShowManualModal(true)}
                  size="sm"
                  className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full px-4 py-2 text-xs shadow-md shadow-blue-500/20 gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" /> Create Project
                </Button>
                <Button
                  onClick={() => setShowImportModal(true)}
                  size="sm"
                  variant="outline"
                  className="bg-card hover:bg-accent border-slate-300 dark:border-slate-700 text-foreground font-bold rounded-full px-4 py-2 text-xs shadow-sm gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Import Project
                </Button>
                <Button
                  onClick={fetchStructureProjects}
                  size="sm"
                  variant="ghost"
                  className="rounded-full p-2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Refresh Projects List"
                >
                  <RefreshCw className={`h-4 w-4 ${isProjectsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter projects by code, name, or details..."
                  value={projectSearchQuery}
                  onChange={(e) => setProjectSearchQuery(e.target.value)}
                  className="pl-10 text-xs rounded-xl border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Status:</span>
                <select
                  value={projectStatusFilter}
                  onChange={(e) => setProjectStatusFilter(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-foreground font-bold text-xs rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Projects Table */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-xl">
            {isProjectsLoading ? (
              <div className="flex h-48 items-center justify-center space-y-2 flex-col">
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
                <p className="text-xs font-semibold text-muted-foreground">Loading projects...</p>
              </div>
            ) : structureProjects.length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground mx-auto">
                  <FolderKanban className="h-8 w-8 text-blue-500 opacity-60" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-foreground">No Projects Created Yet</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                    No projects belong to structure <strong>{selectedStructure?.code}</strong> yet. You can create one manually or import an Excel file.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    onClick={() => setShowManualModal(true)}
                    size="sm"
                    className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full px-5 py-2 text-xs shadow-md shadow-blue-500/20 gap-1.5"
                  >
                    <PlusCircle className="h-4 w-4" /> Create Manual Project
                  </Button>
                  <Button
                    onClick={() => setShowImportModal(true)}
                    size="sm"
                    variant="outline"
                    className="rounded-full px-5 py-2 text-xs font-bold gap-1.5"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Import Excel Project
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 font-extrabold uppercase text-muted-foreground tracking-wider">
                    <tr>
                      <th className="p-4 pl-6">Project Code</th>
                      <th className="p-4">Project Name</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Parts Count</th>
                      <th className="p-4">Created Date</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {structureProjects.map((prj) => (
                      <tr key={prj.id} className="hover:bg-accent/40 transition-colors">
                        <td className="p-4 pl-6 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {prj.code}
                        </td>
                        <td className="p-4 font-bold text-foreground">
                          <div>{prj.name}</div>
                          {prj.description && (
                            <div className="text-[11px] font-normal text-muted-foreground line-clamp-1">{prj.description}</div>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold rounded-full px-2.5 py-0.5 uppercase ${
                              prj.status === 'active'
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                                : prj.status === 'completed'
                                ? 'border-blue-500/40 bg-blue-500/10 text-blue-600'
                                : 'border-slate-500/40 bg-slate-500/10 text-slate-600'
                            }`}
                          >
                            {prj.status}
                          </Badge>
                        </td>
                        <td className="p-4 font-semibold text-foreground">
                          {prj.partsCount || 0} parts
                        </td>
                        <td className="p-4 text-muted-foreground text-[11px]">
                          {prj.createdAt ? new Date(prj.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <Button
                            onClick={() => navigate(`/projects/${prj.id}`)}
                            size="sm"
                            variant="ghost"
                            className="rounded-full text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 gap-1"
                          >
                            View Details <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FIELD SCHEMA EXPLORER */}
      {activeTab === 'explorer' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search field label, internal key (e.g. cat_rating, unique_id)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-xs rounded-xl border-slate-300 dark:border-slate-700"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground">Role Section:</span>
              <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setSelectedRoleFilter('ALL')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                    selectedRoleFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-muted-foreground'
                  }`}
                >
                  All Roles
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRoleFilter('buyer')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                    selectedRoleFilter === 'buyer' ? 'bg-blue-600 text-white' : 'text-muted-foreground'
                  }`}
                >
                  Buyer
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRoleFilter('capacity')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                    selectedRoleFilter === 'capacity' ? 'bg-blue-600 text-white' : 'text-muted-foreground'
                  }`}
                >
                  Capacity Mgr
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRoleFilter('sqd')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                    selectedRoleFilter === 'sqd' ? 'bg-blue-600 text-white' : 'text-muted-foreground'
                  }`}
                >
                  SQD Quality
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-md">
            <div className="p-4 border-b border-border bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                Showing {filteredFields.length} Defined Schema Fields
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 font-extrabold uppercase text-muted-foreground tracking-wider">
                  <tr>
                    <th className="p-3.5 pl-6">Structure</th>
                    <th className="p-3.5">Field Label</th>
                    <th className="p-3.5">Internal Name</th>
                    <th className="p-3.5">Section</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Required</th>
                    <th className="p-3.5 pr-6">Validation / Rules</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredFields.map((item, idx) => (
                    <tr key={`${item.templateCode}-${item.field.internalName}-${idx}`} className="hover:bg-accent/40 transition-colors">
                      <td className="p-3.5 pl-6 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {item.templateCode}
                      </td>
                      <td className="p-3.5 font-bold text-foreground">{item.field.label}</td>
                      <td className="p-3.5 font-mono text-muted-foreground text-[11px]">
                        {item.field.internalName}
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-foreground">
                          {item.sectionName}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                          {item.field.type}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {item.field.required ? (
                          <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold px-2 py-0">
                            Required
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Optional</span>
                        )}
                      </td>
                      <td className="p-3.5 pr-6 text-muted-foreground text-[11px]">
                        {item.field.options && item.field.options.length > 0 ? (
                          <span>Options: {item.field.options.map((o) => o.label).join(', ')}</span>
                        ) : item.field.validation ? (
                          <span>{item.field.validation.type} ({item.field.validation.value || 'defined'})</span>
                        ) : (
                          <span>Standard input</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STRUCTURE COMPARISON */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Project Structure Comparison Matrix</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Comparative architecture analysis of loaded Project Structure definitions.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-slate-50 dark:bg-slate-900">
                    <th className="p-4 font-bold text-muted-foreground w-1/3">Criteria / Feature</th>
                    {templates.map((tmpl) => (
                      <th key={tmpl.id} className="p-4 font-black text-blue-600 dark:text-blue-400 text-sm border-l border-border">
                        {tmpl.code} ({tmpl.name})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-4 font-bold text-foreground">Version & Status</td>
                    {templates.map((tmpl) => (
                      <td key={tmpl.id} className="p-4 border-l border-border font-mono">
                        v{tmpl.version} ({tmpl.status})
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-foreground">Total Sections</td>
                    {templates.map((tmpl) => (
                      <td key={tmpl.id} className="p-4 border-l border-border font-bold">
                        {tmpl.sections?.length || 0} sections
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-foreground">Total Fields Count</td>
                    {templates.map((tmpl) => {
                      const count = tmpl.sections?.reduce(
                        (acc, sec) => acc + (sec.groups?.reduce((gAcc, grp) => gAcc + (grp.fields?.length || 0), 0) || 0),
                        0
                      ) || 0;
                      return (
                        <td key={tmpl.id} className="p-4 border-l border-border font-mono font-bold text-indigo-600">
                          {count} fields
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-foreground">Description</td>
                    {templates.map((tmpl) => (
                      <td key={tmpl.id} className="p-4 border-l border-border text-muted-foreground">
                        {tmpl.description || 'No description provided.'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RAW JSON SCHEMA CODE INSPECTOR */}
      {activeTab === 'json' && selectedStructure && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card p-6 sm:p-8 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  JSON Schema Definition ({selectedStructure.code})
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Template Version {selectedStructure.version} • Status: {selectedStructure.status}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleCopyJson(selectedStructure)}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs font-bold gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy JSON
                </Button>
                <Button
                  onClick={() => handleExportJson(selectedStructure)}
                  size="sm"
                  className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full text-xs gap-1.5 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" /> Download JSON
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0a101d] p-5 font-mono text-xs text-blue-300 overflow-x-auto max-h-[600px] leading-relaxed shadow-inner">
              <pre>{JSON.stringify(selectedStructure, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL PROJECT CREATION */}
      {showManualModal && selectedStructure && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Create Project in <span className="text-blue-600">{selectedStructure.name}</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  The form below is dynamically generated from structure schema <code className="text-blue-500 font-bold">{selectedStructure.code}</code>.
                </p>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <DynamicForm
              template={selectedStructure}
              onSave={handleSaveManualProject}
              isSaving={isCreatingProject}
              title={`New Project Form (${selectedStructure.code})`}
              onCancel={() => setShowManualModal(false)}
            />
          </div>
        </div>
      )}

      {/* MODAL: EXCEL IMPORT PIPELINE */}
      {showImportModal && selectedStructure && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                  Excel Import Pipeline — Structure: <span className="text-blue-600">{selectedStructure.name}</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Detect layout, map fields using RAG AI & memory, validate, preview, and create projects inside <code className="text-blue-500 font-bold">{selectedStructure.code}</code>.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  fetchStructureProjects();
                }}
                className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ImportWizard
              preselectedStructureId={selectedStructure.id}
              preselectedTemplateCode={selectedStructure.code}
              onComplete={() => {
                setShowImportModal(false);
                fetchStructureProjects();
                toast.success(`Import complete! Refreshing ${selectedStructure.code} projects.`);
              }}
            />
          </div>
        </div>
      )}

      {/* MODAL: PROJECT STRUCTURE CREATE / IMPORT (Pipeline A — no project record) */}
      {showStructureWizard && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <LayoutTemplate className="h-5 w-5 text-violet-500" />
                  {structureWizardMode === 'manual'
                    ? 'Create Project Structure (Manual)'
                    : structureWizardMode === 'json'
                    ? 'Import Project Structure'
                    : 'Create Project Structure from Excel'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Define a new Template (sections, fields, orientation). No project record is created here — use Import
                  Projects to load data into a structure.
                </p>
              </div>
              <button
                onClick={() => setShowStructureWizard(false)}
                className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <StructureImportWizard
              initialMode={structureWizardMode}
              onClose={() => setShowStructureWizard(false)}
              onSaved={(created) => {
                setShowStructureWizard(false);
                fetchTemplates();
                if (created?.id) {
                  setSelectedStructureId(created.id);
                  setActiveTemplate(created);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* MODAL: DELETE STRUCTURE CONFIRMATION */}
      {structureToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-foreground">Delete this structure?</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{structureToDelete.code}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong className="text-foreground">{structureToDelete.name}</strong>? This action cannot be undone and will permanently remove this structure definition.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStructureToDelete(null)}
                disabled={isDeletingStructure}
                className="rounded-full px-5 py-2 text-xs font-bold border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteStructure}
                disabled={isDeletingStructure}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full px-5 py-2 text-xs shadow-md shadow-rose-500/20 gap-1.5 cursor-pointer"
              >
                {isDeletingStructure ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {isDeletingStructure ? 'Deleting...' : 'Delete Structure'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
