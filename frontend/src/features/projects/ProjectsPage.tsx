import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useProjectsQuery } from '@/hooks/queries/useProjectsQuery';
import { useDeleteProjectMutation, useBulkDeleteProjectMutation } from '@/hooks/mutations/useProjectMutations';
import { useTemplate } from '@/context/TemplateContext';
import { useLanguage } from '@/context/LanguageContext';
import { DynamicFilterBar } from '@/components/template-engine/DynamicFilterBar';
import { DynamicTable } from '@/components/template-engine/DynamicTable';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Plus, Layers, FileSpreadsheet, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
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

  // Pagination & selection state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);

  const currentTemplate = activeTemplate || templates[0];

  const { data: projectsData, isLoading: isProjectsLoading, refetch } = useProjectsQuery({
    page,
    page_size: pageSize,
    search: searchQuery,
    template_id: currentTemplate?.id,
  });

  const deleteMutation = useDeleteProjectMutation();
  const bulkDeleteMutation = useBulkDeleteProjectMutation();

  // Reset page & selection when search/filters/template change
  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
    setSelectedIds([]);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
    setSelectedIds([]);
  };

  const handleReset = () => {
    setSearchQuery('');
    setFilters({});
    setPage(1);
    setSelectedIds([]);
  };

  const handleTemplateChange = (templateId: string) => {
    const selected = templates.find((t) => t.id === templateId);
    if (selected) {
      setActiveTemplate(selected);
      setPage(1);
      setSelectedIds([]);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setSelectedIds((prev) => prev.filter((item) => item !== id));
        if (filteredProjects.length === 1 && page > 1) {
          setPage(page - 1);
        } else {
          refetch();
        }
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to delete project');
      },
    });
  };

  const handleToggleSelectAll = () => {
    const currentItemIds = filteredProjects.map((p) => p.id);
    const allSelectedOnPage = currentItemIds.length > 0 && currentItemIds.every((id) => selectedIds.includes(id));
    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !currentItemIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentItemIds])));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteConfirm = () => {
    if (selectedIds.length === 0) return;
    bulkDeleteMutation.mutate(selectedIds, {
      onSuccess: (res) => {
        const deletedCount = res?.deleted_count || selectedIds.length;
        setSelectedIds([]);
        setShowBulkDeleteConfirm(false);
        if (filteredProjects.length === deletedCount && page > 1) {
          setPage(page - 1);
        } else {
          refetch();
        }
      },
      onError: (err: any) => {
        setShowBulkDeleteConfirm(false);
      },
    });
  };

  // Filter projects dynamically by template, search, and custom filters
  const allProjects = projectsData?.items || [];
  const totalProjects = projectsData?.total ?? allProjects.length;
  const totalPages = projectsData?.total_pages ?? projectsData?.totalPages ?? Math.max(1, Math.ceil(totalProjects / pageSize));

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
          {/* Bulk Delete Button when items selected */}
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs gap-1.5 cursor-pointer animate-fade-in"
            >
              <Trash2 className="h-4 w-4" /> Delete Selected ({selectedIds.length})
            </Button>
          )}

          {/* Template Switcher */}
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-xl shadow-xs">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground">Template:</span>
            <select
              value={currentTemplate.id}
              onChange={(e) => handleTemplateChange(e.target.value)}
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
        onSearchChange={handleSearchChange}
      />

      {/* Dynamic Data Table Container */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <DynamicTable
          template={currentTemplate}
          projects={filteredProjects}
          onDelete={handleDelete}
          isLoading={isProjectsLoading}
          selectedIds={selectedIds}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleSelectRow={handleToggleSelectRow}
        />

        {/* Pagination Control Bar */}
        <div className="p-4 border-t border-border bg-muted/20">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            total={totalProjects}
            pageSize={pageSize}
            onPageChange={(newPage) => {
              setSelectedIds([]);
              setPage(newPage);
            }}
            onPageSizeChange={(newSize) => {
              setSelectedIds([]);
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-foreground">Delete {selectedIds.length} selected project(s)?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Bulk Project Deletion</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong className="text-foreground">{selectedIds.length} selected project(s)</strong>? This action cannot be undone and will soft-delete these records from the platform.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkDeleteMutation.isPending}
                className="rounded-full px-5 py-2 text-xs font-bold border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleBulkDeleteConfirm}
                disabled={bulkDeleteMutation.isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full px-5 py-2 text-xs shadow-md shadow-rose-500/20 gap-1.5 cursor-pointer"
              >
                {bulkDeleteMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete ${selectedIds.length} Projects`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
