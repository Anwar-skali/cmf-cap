import React from 'react';
import { CMFTemplate, TemplateField } from '@/types/template';
import { Search, RotateCcw } from 'lucide-react';

interface DynamicFilterBarProps {
  template: CMFTemplate;
  filters: Record<string, any>;
  onFilterChange: (key: string, value: any) => void;
  onReset: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const DynamicFilterBar: React.FC<DynamicFilterBarProps> = ({
  template,
  filters,
  onFilterChange,
  onReset,
  searchQuery,
  onSearchChange,
}) => {
  // Collect all fields marked searchable or filterable
  const filterableFields: TemplateField[] = [];
  template.sections?.forEach((sec) => {
    sec.groups?.forEach((grp) => {
      grp.fields?.forEach((fld) => {
        if (fld.search?.filterable || fld.search?.searchable) {
          filterableFields.push(fld);
        }
      });
    });
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row items-center gap-3">
        {/* Quick Text Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search by ${template.searchConfig?.quickFilterFields?.join(', ') || 'code, name, supplier...'}`}
            className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filter Reset Button */}
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-lg transition-colors border border-border"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Filters</span>
        </button>
      </div>

      {/* Dynamic Filter Controls */}
      {filterableFields.length > 0 && (
        <div className="pt-2 border-t border-border/40 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {filterableFields.map((field) => {
            if (field.type === 'dropdown' || field.type === 'status' || field.type === 'radio') {
              return (
                <div key={field.id} className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">{field.label}</label>
                  <select
                    value={filters[field.internalName] || ''}
                    onChange={(e) => onFilterChange(field.internalName, e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">All {field.label}s</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            if (field.type === 'date') {
              return (
                <div key={field.id} className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">{field.label}</label>
                  <input
                    type="date"
                    value={filters[field.internalName] || ''}
                    onChange={(e) => onFilterChange(field.internalName, e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
};
