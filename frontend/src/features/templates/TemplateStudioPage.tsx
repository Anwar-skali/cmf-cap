import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTemplate } from '@/context/TemplateContext';
import { CMFTemplate, TemplateField } from '@/types/template';
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
} from 'lucide-react';
import { toast } from 'sonner';

export default function TemplateStudioPage() {
  const navigate = useNavigate();
  const { templates, activeTemplate, setActiveTemplate, isLoading } = useTemplate();

  const [selectedTemplateCode, setSelectedTemplateCode] = useState<'K0' | 'K9' | 'ALL'>('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'ALL' | 'buyer' | 'capacity' | 'sqd'>('ALL');
  const [activeTab, setActiveTab] = useState<'repository' | 'explorer' | 'matrix' | 'json'>('repository');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const k0Template = templates.find((t) => t.code?.toUpperCase() === 'K0') || templates[0];
  const k9Template = templates.find((t) => t.code?.toUpperCase() === 'K9') || templates[1] || templates[0];

  const currentTemplate =
    selectedTemplateCode === 'K0'
      ? k0Template
      : selectedTemplateCode === 'K9'
      ? k9Template
      : activeTemplate || k0Template;

  const handleCreateProjectWithTemplate = (tmpl: CMFTemplate) => {
    setActiveTemplate(tmpl);
    navigate('/projects/new');
  };

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

  // Collect all fields across selected templates
  const allFieldsWithMeta: Array<{
    templateCode: string;
    sectionName: string;
    sectionId: string;
    groupName: string;
    field: TemplateField;
  }> = [];

  const targetTemplates =
    selectedTemplateCode === 'ALL'
      ? templates
      : templates.filter((t) => t.code?.toUpperCase() === selectedTemplateCode);

  targetTemplates.forEach((tmpl) => {
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

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center space-y-3 flex-col">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm font-semibold text-muted-foreground">Loading CMF Template Studio...</p>
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
          { label: 'Template Studio' },
        ]}
        title="CMF Template Studio & Schema Repository"
        subtitle="Dedicated repository for Stellantis CMF K0 and K9 template schemas, 3-role workflow requirements, field validation rules, and JSON definitions."
        versionBadge="CMF Template Engine v1.0.4"
        extraActions={
          <Button
            onClick={() => handleCreateProjectWithTemplate(currentTemplate || k0Template)}
            size="sm"
            className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full px-5 py-2 text-xs shadow-md shadow-blue-500/20 gap-2 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" /> Create CMF Project
          </Button>
        }
      />

      {/* Navigation Tabs Header */}
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
              <Layers className="h-3.5 w-3.5" /> 1. Repository Hub (K0 & K9)
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
              <Search className="h-3.5 w-3.5" /> 2. Field Schema Explorer ({allFieldsWithMeta.length})
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
              <Sparkles className="h-3.5 w-3.5" /> 3. K0 vs K9 Comparison
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
              <Code2 className="h-3.5 w-3.5" /> 4. JSON Schema Code
            </span>
          </button>
        </div>

        {/* Template Selector Badge Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground">Filter Template:</span>
          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-card">
            <button
              type="button"
              onClick={() => setSelectedTemplateCode('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                selectedTemplateCode === 'ALL' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All (K0 & K9)
            </button>
            <button
              type="button"
              onClick={() => setSelectedTemplateCode('K0')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                selectedTemplateCode === 'K0' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              K0 Only
            </button>
            <button
              type="button"
              onClick={() => setSelectedTemplateCode('K9')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                selectedTemplateCode === 'K9' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              K9 Only
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: REPOSITORY HUB (K0 & K9 CARDS) */}
      {activeTab === 'repository' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* K0 TEMPLATE CARD */}
            {k0Template && (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card p-6 sm:p-8 shadow-xl space-y-6 flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/40 transition-all">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 font-black text-xl border border-blue-500/20">
                        K0
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold text-foreground">{k0Template.name}</h2>
                        <p className="text-xs text-muted-foreground font-mono">Code: K0 • Version {k0Template.version}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full px-3 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Published Standard
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {k0Template.description || 'Standard CMF K0 calculation template for Direct Purchasing, vehicle platform parts, contracted capacity sizing, SCR TKO links, and SQD CAT ratings.'}
                  </p>

                  {/* 3-Role Workflow Modules Preview */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">3-Role Module Structure</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 space-y-1">
                        <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs">
                          <ShoppingBag className="h-3.5 w-3.5" /> 1. Buyer
                        </div>
                        <p className="text-[11px] text-muted-foreground">Part Name, Part Number, SCR Link</p>
                      </div>

                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs">
                          <Gauge className="h-3.5 w-3.5" /> 2. Capacity
                        </div>
                        <p className="text-[11px] text-muted-foreground">Weekly GST, SCR TKO, Contracted</p>
                      </div>

                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs">
                          <ShieldCheck className="h-3.5 w-3.5" /> 3. SQD
                        </div>
                        <p className="text-[11px] text-muted-foreground">CAT Rating, Real Date, SQVL</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <Button
                    onClick={() => handleExportJson(k0Template)}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs font-bold gap-1.5 border-slate-300 dark:border-slate-700"
                  >
                    <Download className="h-3.5 w-3.5" /> JSON Schema
                  </Button>

                  <Button
                    onClick={() => handleCreateProjectWithTemplate(k0Template)}
                    size="sm"
                    className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full px-5 py-2 text-xs shadow-md shadow-blue-500/20 gap-1.5"
                  >
                    Create K0 Project <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* K9 TEMPLATE CARD */}
            {k9Template && (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card p-6 sm:p-8 shadow-xl space-y-6 flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/40 transition-all">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-600 font-black text-xl border border-indigo-500/20">
                        K9
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold text-foreground">{k9Template.name}</h2>
                        <p className="text-xs text-muted-foreground font-mono">Code: K9 • Version {k9Template.version}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full px-3 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Published Standard
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {k9Template.description || 'Standard CMF K9 modular architecture template for multi-supplier sourcing, unique object IDs, weekly capacity measurement, and technical SQD audits.'}
                  </p>

                  {/* 3-Role Workflow Modules Preview */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">3-Role Module Structure</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 space-y-1">
                        <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs">
                          <ShoppingBag className="h-3.5 w-3.5" /> 1. Buyer
                        </div>
                        <p className="text-[11px] text-muted-foreground">Unique ID, Supplier, GST, FETE</p>
                      </div>

                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs">
                          <Gauge className="h-3.5 w-3.5" /> 2. Capacity
                        </div>
                        <p className="text-[11px] text-muted-foreground">Contracted & Weekly Measured</p>
                      </div>

                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs">
                          <ShieldCheck className="h-3.5 w-3.5" /> 3. SQD
                        </div>
                        <p className="text-[11px] text-muted-foreground">CAT Evaluation, Tech Manager</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <Button
                    onClick={() => handleExportJson(k9Template)}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs font-bold gap-1.5 border-slate-300 dark:border-slate-700"
                  >
                    <Download className="h-3.5 w-3.5" /> JSON Schema
                  </Button>

                  <Button
                    onClick={() => handleCreateProjectWithTemplate(k9Template)}
                    size="sm"
                    className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full px-5 py-2 text-xs shadow-md shadow-blue-500/20 gap-1.5"
                  >
                    Create K9 Project <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE FIELD EXPLORER */}
      {activeTab === 'explorer' && (
        <div className="space-y-6">
          {/* Search & Role Filter Bar */}
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

          {/* Fields Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-md">
            <div className="p-4 border-b border-border bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                Showing {filteredFields.length} Defined Schema Fields
              </span>
              <span className="text-[11px] text-muted-foreground">
                Template Filter: {selectedTemplateCode} | Role Filter: {selectedRoleFilter}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 font-extrabold uppercase text-muted-foreground tracking-wider">
                  <tr>
                    <th className="p-3.5 pl-6">Template</th>
                    <th className="p-3.5">Field Label</th>
                    <th className="p-3.5">Internal Name</th>
                    <th className="p-3.5">Role Section</th>
                    <th className="p-3.5">Field Type</th>
                    <th className="p-3.5">Required</th>
                    <th className="p-3.5 pr-6">Validation / Options</th>
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

      {/* TAB 3: K0 VS K9 COMPARISON MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">CMF K0 vs CMF K9 Comparison Matrix</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Comparative architecture analysis of CMF K0 and CMF K9 template definitions.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-slate-50 dark:bg-slate-900">
                    <th className="p-4 font-bold text-muted-foreground w-1/3">Criteria / Feature</th>
                    <th className="p-4 font-black text-blue-600 dark:text-blue-400 text-sm w-1/3 border-l border-border">
                      CMF K0 (Direct Purchasing)
                    </th>
                    <th className="p-4 font-black text-indigo-600 dark:text-indigo-400 text-sm w-1/3 border-l border-border">
                      CMF K9 (Modular Architecture)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-4 font-bold text-foreground">Primary Object Key</td>
                    <td className="p-4 border-l border-border font-mono">part_number & line_item</td>
                    <td className="p-4 border-l border-border font-mono">unique_id & part_number</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-foreground">Buyer Required Fields</td>
                    <td className="p-4 border-l border-border">part_name, part_number, quantity_parts_per_vehicle</td>
                    <td className="p-4 border-l border-border">unique_id, part_name, part_number, supplier, gst_no</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-foreground">Capacity Manager Focus</td>
                    <td className="p-4 border-l border-border">weekly_capacity_requested_gst & scr_tko_link</td>
                    <td className="p-4 border-l border-border">contracted_capacity & weekly_capacity_measured</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-foreground">SQD Evaluation Metric</td>
                    <td className="p-4 border-l border-border">cat_rating (GREEN/AMBER/RED), cat_real_date, sqvl</td>
                    <td className="p-4 border-l border-border">cat_evaluation (GREEN/AMBER/RED), technical_manager</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-bold text-foreground">Workflow Steps</td>
                    <td className="p-4 border-l border-border">4 Steps (Buyer -&gt; Capacity -&gt; SQD -&gt; Validated)</td>
                    <td className="p-4 border-l border-border">4 Steps (Buyer -&gt; Capacity -&gt; SQD -&gt; Validated)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RAW JSON SCHEMA CODE INSPECTOR */}
      {activeTab === 'json' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card p-6 sm:p-8 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  JSON Schema Definition ({currentTemplate?.code})
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Template Version {currentTemplate?.version} • Status: {currentTemplate?.status}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleCopyJson(currentTemplate || k0Template)}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs font-bold gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy JSON
                </Button>
                <Button
                  onClick={() => handleExportJson(currentTemplate || k0Template)}
                  size="sm"
                  className="bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-full text-xs gap-1.5 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" /> Download JSON
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0a101d] p-5 font-mono text-xs text-blue-300 overflow-x-auto max-h-[600px] leading-relaxed shadow-inner">
              <pre>{JSON.stringify(currentTemplate, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
