import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';
import { useDeleteProjectMutation } from '@/hooks/mutations/useProjectMutations';
import { useTemplate } from '@/context/TemplateContext';
import { useLanguage } from '@/context/LanguageContext';
import { DynamicFilterBar } from '@/components/template-engine/DynamicFilterBar';
import { DynamicTable } from '@/components/template-engine/DynamicTable';
import { Button } from '@/components/ui/button';
import { Plus, Layers, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

function isProjectMatchingTemplate(p: any, template: { id: string; code: string } | null): boolean {
  if (!template) return true;

  const currentCode = (template.code || '').toUpperCase();
  const projTemplateId = p.templateId || p.template_id;
  const projTemplateCode = (
    p.templateCode ||
    p.template_code ||
    p.data?.template_code ||
    p.data?.templateCode ||
    p.data?.cmf_type ||
    ''
  ).toUpperCase();

  // 1. Direct template ID match
  if (projTemplateId && template.id) {
    if (String(projTemplateId) === String(template.id)) {
      return true;
    }
    return false;
  }

  // 2. Direct template code match
  if (projTemplateCode) {
    return projTemplateCode === currentCode;
  }

  // 3. Fallback inference by field set
  const isK0Data = !!(
    p.data?.line_item ||
    p.data?.tazebao_id_dev_system_no ||
    p.data?.gst_source_package_number ||
    p.data?.components_package_rfq ||
    p.code?.toUpperCase().includes('K0')
  );

  if (currentCode === 'K0') {
    return isK0Data;
  }

  if (currentCode === 'K9') {
    const isK9Data = !!(
      p.data?.unique_id ||
      p.data?.apqp ||
      p.data?.use_case ||
      p.code?.toUpperCase().includes('K9')
    );
    return isK9Data || !isK0Data;
  }

  return true;
}

export default function ProjectsPage() {
  const { t } = useLanguage();
  const { templates, activeTemplate, setActiveTemplate, isLoading: isTemplateLoading } = useTemplate();
  const { data: projectsData, isLoading: isProjectsLoading, refetch } = useProjectsQuery();
  const deleteMutation = useDeleteProjectMutation();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState<Record<string, any>>({});

  const currentTemplate = activeTemplate || templates[0];

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setSearchQuery('');
    setFilters({});
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Project deleted');
        refetch();
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to delete project');
      },
    });
  };

  // Filter projects dynamically by template, search, and custom filters
  const allProjects = projectsData?.items || [];
  const filteredProjects = allProjects.filter((p) => {
    // Ensure template match (K0 vs K9)
    if (!isProjectMatchingTemplate(p, currentTemplate)) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = p.name.toLowerCase().includes(q);
      const codeMatch = p.code.toLowerCase().includes(q);
      const dataMatch = Object.values(p.data || {}).some((v) =>
        String(v).toLowerCase().includes(q)
      );
      if (!nameMatch && !codeMatch && !dataMatch) return false;
    }

    for (const [key, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '') {
        const prjVal = p.data?.[key] ?? (p as any)[key];
        if (String(prjVal).toLowerCase() !== String(val).toLowerCase()) {
          return false;
        }
      }
    }

    return true;
  });

  if (isTemplateLoading || !currentTemplate) {
    return (
      <div className="flex h-64 items-center justify-center space-y-3 flex-col bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground">{t('common.loading', 'Loading Template Engine...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {t('projects.title', 'CMF Projects Portfolio')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('projects.subtitle', 'Manage automotive vehicle platform projects and supplier capacities')} ({currentTemplate.code})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Template Switcher */}
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-xs">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground">Template:</span>
            <select
              value={currentTemplate.id}
              onChange={(e) => {
                const selected = templates.find((t) => t.id === e.target.value);
                if (selected) setActiveTemplate(selected);
              }}
              className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id} className="bg-card text-foreground">
                  Template {t.code} v{t.version} ({t.status})
                </option>
              ))}
            </select>
          </div>

          <Button variant="outline" asChild size="sm" className="border-border bg-card text-foreground hover:bg-accent">
            <Link to="/documents">
              <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Excel Setup
            </Link>
          </Button>

          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md">
            <Link to="/projects/new">
              <Plus className="mr-2 h-4 w-4" /> {t('projects.new_project', 'New Project')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Dynamic Search & Filter Bar */}
      <DynamicFilterBar
        template={currentTemplate}
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Dynamic Data Table Container */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <DynamicTable
          template={currentTemplate}
          projects={filteredProjects}
          onDelete={handleDelete}
          isLoading={isProjectsLoading}
        />
      </div>
    </div>
  );
}
