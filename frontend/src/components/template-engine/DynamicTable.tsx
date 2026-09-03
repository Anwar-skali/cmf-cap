import React from 'react';
import { CMFTemplate, TemplateField } from '@/types/template';
import { Project } from '@/types';
import { Eye, Edit2, Trash2, ArrowUpDown, ShieldAlert, CheckCircle2, Clock, AlertCircle, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DynamicTableProps {
  template: CMFTemplate;
  projects: Project[];
  onDelete?: (id: string) => void;
  isLoading?: boolean;
  selectedIds?: string[];
  onToggleSelectAll?: () => void;
  onToggleSelectRow?: (id: string) => void;
}

// Curated column definitions for CMF K9 template
const K9_TABLE_COLUMNS: TemplateField[] = [
  { id: 'col_part_number', internalName: 'part_number', label: 'Part Number', type: 'text', order: 1 },
  { id: 'col_supplier_name', internalName: 'supplier_name', label: 'Supplier', type: 'supplier', order: 2 },
  { id: 'col_capacity', internalName: 'capacity', label: 'Capacity', type: 'integer', order: 3 },
  { id: 'col_contracted_capacity', internalName: 'contracted_capacity', label: 'Contracted Cap.', type: 'integer', order: 4 },
  { id: 'col_cat_evaluation', internalName: 'cat_evaluation', label: 'CAT Status', type: 'cat_status', order: 5 },
];

// Curated column definitions for CMF K0 template
const K0_TABLE_COLUMNS: TemplateField[] = [
  { id: 'col_part_number', internalName: 'part_number', label: 'Part Number', type: 'text', order: 1 },
  { id: 'col_supplier_name', internalName: 'nominated_supplier', label: 'Supplier', type: 'supplier', order: 2 },
  { id: 'col_make_or_buy', internalName: 'make_or_buy', label: 'Make/Buy', type: 'text', order: 3 },
  { id: 'col_contracted_capacity', internalName: 'contracted_capacity', label: 'Contracted Cap.', type: 'integer', order: 4 },
  { id: 'col_cat_rating', internalName: 'cat_rating', label: 'CAT Rating', type: 'cat_status', order: 5 },
];

export const DynamicTable: React.FC<DynamicTableProps> = ({
  template,
  projects,
  onDelete,
  isLoading = false,
  selectedIds = [],
  onToggleSelectAll,
  onToggleSelectRow,
}) => {
  const templateCode = template?.code?.toUpperCase();

  // Determine visible columns:
  // 1. Try opt-in fields from template (search.visibleInTable === true)
  // 2. Fall back to curated K9/K0 columns
  // 3. Otherwise show first 5 non-textarea fields
  let visibleColumns: TemplateField[] = [];

  const optInColumns: TemplateField[] = [];
  template.sections?.forEach((sec) => {
    sec.groups?.forEach((grp) => {
      grp.fields?.forEach((fld) => {
        if (fld.search?.visibleInTable === true) {
          optInColumns.push(fld);
        }
      });
    });
  });

  if (optInColumns.length > 0) {
    visibleColumns = optInColumns;
  } else if (templateCode === 'K9') {
    visibleColumns = K9_TABLE_COLUMNS;
  } else if (templateCode === 'K0') {
    visibleColumns = K0_TABLE_COLUMNS;
  } else {
    // Generic fallback: first 5 non-textarea fields
    const allFields: TemplateField[] = [];
    template.sections?.forEach((sec) => {
      sec.groups?.forEach((grp) => {
        grp.fields?.forEach((fld) => {
          if (fld.type !== 'textarea' && fld.type !== 'file_upload' && fld.type !== 'calculated') {
            allFields.push(fld);
          }
        });
      });
    });
    visibleColumns = allFields.slice(0, 6);
  }

  const getWorkflowStep = (project: Project): number => {
    return Number(project.data?.workflow_step) || 1;
  };

  const getProjectDisplayName = (project: Project): string => {
    // For K9/K0, prefer part_name from data over the base project.name
    return project.data?.part_name || project.name || '—';
  };

  const renderWorkflowBadge = (project: Project) => {
    const step = getWorkflowStep(project);
    const configs = [
      { step: 1, label: 'Step 1 · Capacity', cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: <Clock className="h-3 w-3" /> },
      { step: 2, label: 'Step 2 · Buyer', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', icon: <Clock className="h-3 w-3" /> },
      { step: 3, label: 'Step 3 · SQD', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: <AlertCircle className="h-3 w-3" /> },
      { step: 4, label: 'Complete', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: <CheckCircle2 className="h-3 w-3" /> },
    ];
    const cfg = configs.find((c) => c.step === step) || configs[0];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.cls}`}>
        {cfg.icon}
        {cfg.label}
      </span>
    );
  };

  const renderCellContent = (project: Project, field: TemplateField) => {
    let val = project.data?.[field.internalName] ?? (project as any)[field.internalName];

    // Fallbacks for common aliases between K9 and K0
    if (val === undefined || val === null || val === '') {
      const data = project.data || {};
      if (field.internalName === 'part_name') {
        val = data.part_name || project.name;
      } else if (field.internalName === 'part_number') {
        val = data.part_number || data.unique_id || data.line_item || project.code;
      } else if (field.internalName === 'supplier_name' || field.internalName === 'nominated_supplier') {
        val = data.supplier_name || data.nominated_supplier || data.supplier_name_co_parts || data.supplier_info || data.supplier;
      } else if (field.internalName === 'capacity') {
        val = data.capacity || data.weekly_capacity_requested_gst || data.weekly_capacity_requested_tko || data.weekly_capacity_latest_ltos;
      } else if (field.internalName === 'contracted_capacity') {
        val = data.contracted_capacity;
      } else if (field.internalName === 'cat_evaluation' || field.internalName === 'cat_rating') {
        val = data.cat_evaluation || data.cat_rating || data.last_cat;
      }
    }

    if (val === undefined || val === null || val === '') {
      return <span className="text-muted-foreground/40 italic text-[11px]">—</span>;
    }

    // Supplier badge rendering (matches field type 'supplier' or any supplier field name)
    const isSupplierField =
      field.type === 'supplier' ||
      field.internalName === 'supplier_name' ||
      field.internalName === 'nominated_supplier' ||
      field.internalName === 'supplier_name_co_parts' ||
      field.internalName === 'supplier';

    if (isSupplierField) {
      let supplierText = val;
      if (typeof val === 'object' && val !== null) {
        supplierText = val.name || val.label || val.value || JSON.stringify(val);
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          <Building2 className="h-3 w-3 shrink-0 opacity-70" />
          <span>{String(supplierText)}</span>
        </span>
      );
    }

    // CAT evaluation / rating status badge
    if (field.type === 'cat_status' || field.internalName === 'cat_evaluation' || field.internalName === 'cat_rating') {
      const catColors: Record<string, string> = {
        GREEN: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        ORANGE: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
        RED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
      };
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${catColors[String(val)] || 'bg-muted text-muted-foreground border-border'}`}>
          {String(val)}
        </span>
      );
    }

    if (field.type === 'currency') {
      return <span className="font-mono font-semibold">€{Number(val).toLocaleString('fr-FR')}</span>;
    }

    if (field.type === 'percentage') {
      return <span className="font-mono font-semibold">{val}%</span>;
    }

    if (field.type === 'integer' || field.type === 'decimal') {
      return <span className="font-mono font-semibold tabular-nums">{Number(val).toLocaleString()}</span>;
    }

    if (field.type === 'date') {
      return <span className="text-xs">{String(val).split('T')[0]}</span>;
    }

    if (field.type === 'status') {
      const statusColors: Record<string, string> = {
        active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        draft: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
        on_hold: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        completed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        cancelled: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      };
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColors[String(val).toLowerCase()] || 'bg-muted text-muted-foreground'}`}>
          {String(val).toUpperCase()}
        </span>
      );
    }

    if (field.internalName === 'risk_level') {
      const riskColors: Record<string, string> = {
        GREEN: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        AMBER: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        RED: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
      };
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${riskColors[String(val)] || 'bg-muted text-muted-foreground'}`}>
          {val === 'RED' && <ShieldAlert className="h-3 w-3" />}
          {val}
        </span>
      );
    }

    // Truncate long text
    const strVal = String(val);
    return <span title={strVal}>{strVal.length > 30 ? strVal.slice(0, 28) + '…' : strVal}</span>;
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading projects...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
        <p className="text-base font-semibold text-foreground">No projects found</p>
        <p className="text-xs text-muted-foreground">
          No CMF projects match your current filter parameters or active template ({template.code}).
        </p>
      </div>
    );
  }

  const isAllSelected = projects.length > 0 && projects.every((p) => selectedIds.includes(p.id));

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
              {onToggleSelectRow && (
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={onToggleSelectAll}
                    className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary h-4 w-4 cursor-pointer accent-primary"
                    title="Select all on current page"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-bold whitespace-nowrap">Code</th>
              <th className="px-4 py-3 font-bold whitespace-nowrap">Project Name</th>
              {visibleColumns.map((col) => (
                <th key={col.id} className="px-4 py-3 font-bold whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {col.search?.sortable && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 font-bold whitespace-nowrap">Workflow</th>
              <th className="px-4 py-3 font-bold text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {projects.map((project) => {
              const isSelected = selectedIds.includes(project.id);
              return (
                <tr
                  key={project.id}
                  className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/10 dark:bg-primary/20' : ''}`}
                >
                  {onToggleSelectRow && (
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectRow(project.id)}
                        className="rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary h-4 w-4 cursor-pointer accent-primary"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono font-bold text-primary whitespace-nowrap">
                    <Link to={`/projects/${project.id}`} className="hover:underline">
                      {project.code}
                    </Link>
                  </td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap max-w-[200px]">
                  <Link to={`/projects/${project.id}`} className="hover:text-primary truncate block">
                    {getProjectDisplayName(project)}
                  </Link>
                </td>
                {visibleColumns.map((col) => (
                  <td key={col.id} className="px-4 py-3 whitespace-nowrap">
                    {renderCellContent(project, col)}
                  </td>
                ))}
                <td className="px-4 py-3 whitespace-nowrap">
                  {renderWorkflowBadge(project)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      to={`/projects/${project.id}`}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      to={`/projects/${project.id}/edit`}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit Project"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Link>
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(project.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </div>
  );
};
