import React, { useState } from 'react';
import { CMFTemplate, TemplateField, TemplateSection } from '@/types/template';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSuppliersQuery } from '@/hooks/queries/useSuppliersQuery';
import { useUsersQuery } from '@/hooks/queries/useUsersQuery';
import {
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Table as TableIcon,
  Grid,
  Filter,
  UserCheck,
  Building2,
  Award,
  Sparkles,
  Edit2,
  Check,
  X,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProjectMasterTableViewProps {
  project: any;
  template: CMFTemplate;
  templateCode?: string;
  onSave?: (updatedData: Record<string, any>) => void | Promise<void>;
  isSaving?: boolean;
  userRole?: string;
}

export const ProjectMasterTableView: React.FC<ProjectMasterTableViewProps> = ({
  project,
  template,
  templateCode,
  onSave,
  isSaving = false,
  userRole = 'buyer',
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'FILLED' | 'MISSING'>('ALL');
  const [viewStyle, setViewStyle] = useState<'architecture' | 'horizontal_matrix'>('architecture');

  // Quick Inline Edit State
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<any>('');

  // Fetch suppliers and users for ID → display name resolution in read-only view
  const { data: suppliersData } = useSuppliersQuery({ pageSize: 200 });
  const { data: usersData } = useUsersQuery({ pageSize: 200 });
  const allSuppliers = suppliersData?.items ?? [];
  const allUsers = usersData?.items ?? [];

  const activeTemplateCode = (templateCode || template?.code || 'K9').toUpperCase();
  const projectData = project.data || {};

  const getRawFieldValue = (internalName: string) => {
    if (projectData[internalName] !== undefined && projectData[internalName] !== null) {
      return projectData[internalName];
    }
    if (internalName === 'part_name' || internalName === 'project_name') return project.name;
    if (internalName === 'part_number' || internalName === 'unique_id' || internalName === 'project_code' || internalName === 'line_item') {
      return project.code;
    }
    return '';
  };

  // Flatten all fields with section and group metadata
  const allFieldsMeta: Array<{
    section: TemplateSection;
    groupName: string;
    field: TemplateField;
    value: any;
    isFilled: boolean;
    roleRequired: 'buyer' | 'capacity_manager' | 'sqd' | 'all';
  }> = [];

  (template?.sections || []).forEach((sec) => {
    let secRoleReq: 'buyer' | 'capacity_manager' | 'sqd' | 'all' = 'all';
    const secAllowed = sec.permissions?.rolesAllowedToEdit;
    if (secAllowed && secAllowed.length > 0) {
      if (secAllowed.includes('buyer')) secRoleReq = 'buyer';
      else if (secAllowed.includes('capacity_manager')) secRoleReq = 'capacity_manager';
      else if (secAllowed.includes('sqd')) secRoleReq = 'sqd';
    } else {
      const secIdLower = sec.id.toLowerCase();
      const secNameLower = sec.name.toLowerCase();
      if (secIdLower.includes('buyer') || secNameLower.includes('buyer')) secRoleReq = 'buyer';
      else if (secIdLower.includes('capacity') || secNameLower.includes('capacity')) secRoleReq = 'capacity_manager';
      else if (secIdLower.includes('sqd') || secNameLower.includes('sqd')) secRoleReq = 'sqd';
    }

    sec.groups?.forEach((grp) => {
      grp.fields?.forEach((fld) => {
        let fldRoleReq = secRoleReq;
        const fldAllowed = fld.permissions?.rolesAllowedToEdit;
        if (fldAllowed && fldAllowed.length > 0) {
          if (fldAllowed.includes('buyer')) fldRoleReq = 'buyer';
          else if (fldAllowed.includes('capacity_manager')) fldRoleReq = 'capacity_manager';
          else if (fldAllowed.includes('sqd')) fldRoleReq = 'sqd';
        }

        const val = getRawFieldValue(fld.internalName);
        const isFilled = val !== undefined && val !== null && String(val).trim() !== '';
        allFieldsMeta.push({
          section: sec,
          groupName: grp.name,
          field: fld,
          value: val,
          isFilled,
          roleRequired: fldRoleReq,
        });
      });
    });
  });

  const totalFields = allFieldsMeta.length;
  const filledFieldsCount = allFieldsMeta.filter((f) => f.isFilled).length;
  const completionPercentage = totalFields > 0 ? Math.round((filledFieldsCount / totalFields) * 100) : 0;

  // Filtered list
  const filteredFields = allFieldsMeta.filter((item) => {
    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLabel = item.field.label.toLowerCase().includes(q);
      const matchKey = item.field.internalName.toLowerCase().includes(q);
      const matchGrp = item.groupName.toLowerCase().includes(q);
      const matchVal = String(item.value).toLowerCase().includes(q);
      if (!matchLabel && !matchKey && !matchGrp && !matchVal) return false;
    }

    // Section Filter
    if (selectedSectionFilter !== 'ALL') {
      if (item.section.id !== selectedSectionFilter && !item.section.name.includes(selectedSectionFilter)) {
        return false;
      }
    }

    // Status Filter
    if (statusFilter === 'FILLED' && !item.isFilled) return false;
    if (statusFilter === 'MISSING' && item.isFilled) return false;

    return true;
  });

  // Handle Quick Save
  const handleStartInlineEdit = (item: (typeof allFieldsMeta)[0]) => {
    setEditingFieldKey(item.field.internalName);
    setEditingValue(item.value ?? '');
  };

  const handleCancelInlineEdit = () => {
    setEditingFieldKey(null);
    setEditingValue('');
  };

  const handleSaveInlineEdit = async (internalName: string) => {
    if (!onSave) return;
    try {
      const updated = {
        ...projectData,
        [internalName]: editingValue,
      };
      await onSave(updated);
      toast.success(`Updated field "${internalName}"`);
      setEditingFieldKey(null);
    } catch {
      toast.error('Failed to save value');
    }
  };

  // Value Renderer Formatter
  const renderFormattedValue = (field: TemplateField, rawVal: any) => {
    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
      return (
        <span className="text-muted-foreground/60 italic text-xs flex items-center gap-1">
          {field.required && <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />}
          — Not set —
        </span>
      );
    }

    // Supplier ID → name resolution
    if (field.type === 'supplier') {
      const supplierMatch = allSuppliers.find(
        (s) => s.id === String(rawVal) || s.name.toLowerCase() === String(rawVal).toLowerCase()
      );
      const displayName = supplierMatch
        ? `${supplierMatch.name}${supplierMatch.code ? ` (${supplierMatch.code})` : ''}`
        : String(rawVal);
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-xs text-foreground">
          <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          {displayName}
        </span>
      );
    }

    // User ID → name resolution
    if (field.type === 'user') {
      const userMatch = allUsers.find(
        (u) => u.id === String(rawVal) || u.email === String(rawVal)
      );
      let displayUser = String(rawVal);
      if (userMatch) {
        const firstName = (userMatch as any).firstName || (userMatch as any).first_name || '';
        const lastName = (userMatch as any).lastName || (userMatch as any).last_name || '';
        const fullName = [firstName, lastName].filter(Boolean).join(' ');
        displayUser = fullName || userMatch.email;
      }
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-xs text-foreground">
          <UserCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          {displayUser}
        </span>
      );
    }

    const strVal = String(rawVal);

    // URL or Link
    if (strVal.startsWith('http://') || strVal.startsWith('https://')) {
      return (
        <a
          href={strVal}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline max-w-xs truncate"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          <span>{strVal}</span>
        </a>
      );
    }

    // Status Ratings (GREEN, AMBER, RED)
    const upper = strVal.toUpperCase();
    if (upper === 'GREEN' || upper === 'OK' || upper === 'PASSED') {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 w-max">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> GREEN
        </Badge>
      );
    }
    if (upper === 'AMBER' || upper === 'YELLOW' || upper === 'WARNING') {
      return (
        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 w-max">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> AMBER
        </Badge>
      );
    }
    if (upper === 'RED' || upper === 'FAILED' || upper === 'NOK') {
      return (
        <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 w-max">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> RED
        </Badge>
      );
    }

    // Currency
    if (field.type === 'currency' && !isNaN(Number(strVal))) {
      return (
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
          € {Number(strVal).toLocaleString()}
        </span>
      );
    }

    // Boolean
    if (field.type === 'boolean' || strVal === 'true' || strVal === 'false') {
      const isTrue = strVal === 'true' || strVal === 'YES' || strVal === '1';
      return (
        <Badge
          variant="outline"
          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
            isTrue
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
              : 'border-slate-300 dark:border-slate-700 text-muted-foreground'
          }`}
        >
          {isTrue ? 'YES' : 'NO'}
        </Badge>
      );
    }

    // Dropdown label resolution
    if (field.options && field.options.length > 0) {
      const opt = field.options.find((o) => o.value === strVal);
      if (opt) {
        return <span className="font-semibold text-foreground text-xs">{opt.label}</span>;
      }
    }

    return <span className="font-medium text-foreground text-xs max-w-sm truncate block">{strVal}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Metrics Banner Card */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 font-extrabold border border-blue-500/20">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  Master Project Data Table ({activeTemplateCode})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Comprehensive 100% full view of all project attributes across template sections & field groups.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Completion Pill */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-2xl">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Data Completeness</p>
                <p className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                  {filledFieldsCount} / {totalFields} fields ({completionPercentage}%)
                </p>
              </div>
              <div className="h-9 w-9 rounded-full border-2 border-blue-600 flex items-center justify-center text-[10px] font-extrabold text-foreground bg-blue-500/10">
                {completionPercentage}%
              </div>
            </div>

            {/* View Switcher Toggle */}
            <div className="inline-flex rounded-xl border border-slate-300 dark:border-slate-700 p-0.5 bg-card">
              <button
                type="button"
                onClick={() => setViewStyle('architecture')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  viewStyle === 'architecture' ? 'bg-blue-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" /> Structured Table
              </button>
              <button
                type="button"
                onClick={() => setViewStyle('horizontal_matrix')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  viewStyle === 'horizontal_matrix' ? 'bg-blue-600 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Grid className="h-3.5 w-3.5" /> Horizontal Matrix
              </button>
            </div>
          </div>
        </div>

        {/* Section Completion Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search field label, internal key, group or stored value..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 text-xs rounded-xl border-slate-300 dark:border-slate-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Section Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Section:</span>
            <select
              value={selectedSectionFilter}
              onChange={(e) => setSelectedSectionFilter(e.target.value)}
              className="bg-card text-xs font-bold text-foreground border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-xl cursor-pointer"
            >
              <option value="ALL">All Sections ({template?.sections?.length || 0})</option>
              {template?.sections?.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-card">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-muted-foreground'
              }`}
            >
              All ({allFieldsMeta.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('FILLED')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer ${
                statusFilter === 'FILLED' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'
              }`}
            >
              Filled ({filledFieldsCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('MISSING')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer ${
                statusFilter === 'MISSING' ? 'bg-amber-600 text-white' : 'text-muted-foreground'
              }`}
            >
              Missing ({totalFields - filledFieldsCount})
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: STRUCTURED ARCHITECTURE MASTER TABLE */}
      {viewStyle === 'architecture' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-xl">
          <div className="p-4 border-b border-border bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-extrabold text-foreground">
                Displaying {filteredFields.length} Attributes in Master Data Table
              </span>
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground">
              Template Code: {activeTemplateCode} v{template?.version}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800/90 font-extrabold uppercase text-muted-foreground tracking-wider border-b border-border">
                <tr>
                  <th className="p-3.5 pl-6 w-48">Section / Module</th>
                  <th className="p-3.5 w-44">Field Group</th>
                  <th className="p-3.5 w-52">Attribute Label</th>
                  <th className="p-3.5 w-40 font-mono text-[11px]">Internal Key</th>
                  <th className="p-3.5 w-28">Type</th>
                  <th className="p-3.5">Current Project Value</th>
                  <th className="p-3.5 w-24 text-center">Status</th>
                  <th className="p-3.5 pr-6 w-24 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFields.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground text-xs">
                      No matching project attributes found for your search or filter parameters.
                    </td>
                  </tr>
                ) : (
                  filteredFields.map((item, idx) => {
                    const isEditing = editingFieldKey === item.field.internalName;
                    const normRole = (userRole || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
                    const effectiveRole =
                      normRole === 'capacity' || normRole === 'capacitymanager' || normRole === 'cap_manager'
                        ? 'capacity_manager'
                        : normRole === 'purchasing'
                        ? 'buyer'
                        : normRole === 'quality' || normRole === 'quality_lead' || normRole === 'sqd_team'
                        ? 'sqd'
                        : normRole;

                    const canEditItem =
                      effectiveRole === 'admin' ||
                      item.roleRequired === 'all' ||
                      item.roleRequired === effectiveRole;

                    return (
                      <tr
                        key={`${item.section.id}-${item.field.internalName}-${idx}`}
                        className={`hover:bg-accent/40 transition-colors ${
                          !item.isFilled && item.field.required ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        {/* Section */}
                        <td className="p-3.5 pl-6 font-bold text-foreground">
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                            {item.roleRequired === 'buyer' && <UserCheck className="h-3.5 w-3.5 text-blue-500" />}
                            {item.roleRequired === 'capacity_manager' && <Building2 className="h-3.5 w-3.5 text-amber-500" />}
                            {item.roleRequired === 'sqd' && <Award className="h-3.5 w-3.5 text-emerald-500" />}
                            {item.section.name}
                          </span>
                        </td>

                        {/* Field Group */}
                        <td className="p-3.5 font-semibold text-muted-foreground text-[11px]">
                          {item.groupName}
                        </td>

                        {/* Attribute Label */}
                        <td className="p-3.5 font-extrabold text-foreground">
                          <span className="flex items-center gap-1">
                            {item.field.label}
                            {item.field.required && <span className="text-rose-500 font-black">*</span>}
                          </span>
                        </td>

                        {/* Internal Key */}
                        <td className="p-3.5 font-mono text-muted-foreground text-[11px]">
                          {item.field.internalName}
                        </td>

                        {/* Type */}
                        <td className="p-3.5 font-mono text-[10px]">
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold px-2 py-0.5 rounded-md border border-border">
                            {item.field.type}
                          </span>
                        </td>

                        {/* Stored Value */}
                        <td className="p-3.5">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="text"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="text-xs h-8 py-1 rounded-lg border-blue-500 focus:ring-blue-500"
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="default"
                                className="h-7 w-7 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                                onClick={() => handleSaveInlineEdit(item.field.internalName)}
                                disabled={isSaving}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                onClick={handleCancelInlineEdit}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            renderFormattedValue(item.field, item.value)
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-3.5 text-center">
                          {item.isFilled ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              <AlertCircle className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="p-3.5 pr-6 text-right">
                          {canEditItem && onSave && !isEditing ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartInlineEdit(item)}
                              className="h-7 px-2 text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
                            >
                              <Edit2 className="h-3 w-3 mr-1" /> Edit
                            </Button>
                          ) : !canEditItem && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 font-semibold">
                              <Lock className="h-2.5 w-2.5" /> Read-only
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: HORIZONTAL MATRIX SPREADSHEET TABLE */}
      {viewStyle === 'horizontal_matrix' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-xl space-y-2">
          <div className="p-4 border-b border-border bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-2">
              <Grid className="h-4 w-4 text-blue-600" /> Full Horizontal Matrix View (Every Field Column)
            </span>
            <span className="text-[11px] text-muted-foreground">Scroll horizontally to inspect all columns</span>
          </div>

          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-slate-100 dark:bg-slate-800/90 font-extrabold uppercase text-muted-foreground tracking-wider border-b border-border">
                <tr>
                  <th className="p-3.5 pl-6 sticky left-0 z-20 bg-slate-200 dark:bg-slate-800 shadow-sm min-w-[200px]">
                    Project Code / Name
                  </th>
                  {filteredFields.map((item, idx) => (
                    <th key={`hdr-${item.field.internalName}-${idx}`} className="p-3.5 border-l border-border min-w-[160px]">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">{item.section.name}</span>
                        <span className="text-xs text-foreground font-bold">{item.field.label}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{item.field.internalName}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-accent/40">
                  <td className="p-3.5 pl-6 sticky left-0 z-10 bg-card font-extrabold text-foreground border-r border-border shadow-xs">
                    <div>
                      <p className="font-black text-sm text-primary">{project.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{project.code}</p>
                    </div>
                  </td>

                  {filteredFields.map((item, idx) => (
                    <td key={`cell-${item.field.internalName}-${idx}`} className="p-3.5 border-l border-border">
                      {renderFormattedValue(item.field, item.value)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
