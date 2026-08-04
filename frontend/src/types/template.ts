export type FieldType =
  | 'text'
  | 'textarea'
  | 'integer'
  | 'decimal'
  | 'currency'
  | 'date'
  | 'week'
  | 'boolean'
  | 'email'
  | 'phone'
  | 'dropdown'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'user'
  | 'supplier'
  | 'project'
  | 'status'
  | 'cat_status'
  | 'file_upload'
  | 'percentage'
  | 'calculated'
  | 'readonly';

export interface DropdownOption {
  value: string;
  label: string;
  order?: number;
}

export interface ValidationRule {
  type: string; // required, minLength, maxLength, regex, unique, enum, numberRange, dateRange, custom, conditional, crossField
  value?: any;
  message?: string;
}

export interface ConditionalRule {
  type: 'show' | 'hide' | 'require';
  field: string; // internalName of target field
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value?: any;
}

export interface CalculationRule {
  expression: string; // e.g. "actual_cost - target_cost"
}

export interface ExcelMapping {
  columnName?: string;
  position?: number;
  importAlias?: string;
  exportAlias?: string;
}

export interface SearchConfig {
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  visibleInTable?: boolean;
  visibleInExport?: boolean;
}

export interface PermissionRule {
  rolesAllowedToEdit?: string[];
  rolesAllowedToView?: string[];
}

export interface TemplateField {
  id: string;
  internalName: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
  order?: number;
  visible?: boolean;
  editable?: boolean;
  options?: DropdownOption[];
  validation?: ValidationRule;
  conditions?: ConditionalRule[];
  calculation?: CalculationRule;
  excel?: ExcelMapping;
  search?: SearchConfig;
  permissions?: PermissionRule;
}

export interface FieldGroup {
  id: string;
  name: string;
  order?: number;
  description?: string;
  fields: TemplateField[];
}

export interface TemplateSection {
  id: string;
  name: string;
  order?: number;
  icon?: string;
  description?: string;
  groups: FieldGroup[];
}

export interface DashboardKpi {
  id: string;
  title: string;
  field: string;
  aggregation: 'avg' | 'sum' | 'count' | 'min' | 'max';
  format: 'currency' | 'percentage' | 'number';
  icon?: string;
}

export interface DashboardChartMetric {
  field: string;
  aggregation: string;
  label: string;
  color: string;
}

export interface DashboardChart {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'pie';
  groupBy: string;
  metrics: DashboardChartMetric[];
}

export interface DashboardConfig {
  kpis: DashboardKpi[];
  charts: DashboardChart[];
}

export interface TemplateSearchConfig {
  defaultSortBy?: string;
  defaultSortDesc?: boolean;
  defaultPageSize?: number;
  quickFilterFields?: string[];
}

export interface CMFTemplate {
  id: string;
  code: string;
  name: string;
  version: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  description?: string;
  schema_json?: {
    code: string;
    name: string;
    version: string;
    status: string;
    description?: string;
    sections: TemplateSection[];
    dashboardConfig?: DashboardConfig;
    searchConfig?: TemplateSearchConfig;
  };
  sections: TemplateSection[];
  dashboardConfig?: DashboardConfig;
  searchConfig?: TemplateSearchConfig;
  created_at?: string;
  updated_at?: string;
}
