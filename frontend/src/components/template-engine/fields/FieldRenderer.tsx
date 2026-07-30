import React from 'react';
import { TemplateField, DropdownOption } from '@/types/template';
import { SupplierSelectField } from './SupplierSelectField';
import { UserSelectField } from './UserSelectField';
import { HelpCircle, AlertCircle, Upload, Check, Euro, Calendar, Phone, Mail, Hash, Percent, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FieldRendererProps {
  field: TemplateField;
  value: any;
  onChange: (val: any) => void;
  disabled?: boolean;
  error?: string;
  formValues?: Record<string, any>;
  userRole?: string;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  value,
  onChange,
  disabled = false,
  error,
  formValues = {},
  userRole,
}) => {
  const isRoleAllowedToEdit = (): boolean => {
    if (!field.permissions?.rolesAllowedToEdit || field.permissions.rolesAllowedToEdit.length === 0) {
      return true;
    }
    if (!userRole) return true;
    return field.permissions.rolesAllowedToEdit.includes(userRole.toLowerCase());
  };

  const isEditable = field.editable !== false && !disabled && isRoleAllowedToEdit();

  const computeCalculatedValue = (): any => {
    if (field.type !== 'calculated' || !field.calculation?.expression) return value ?? 0;
    try {
      let expr = field.calculation.expression;
      Object.keys(formValues).forEach((key) => {
        const val = Number(formValues[key]) || 0;
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        expr = expr.replace(regex, val.toString());
      });
      const res = Function(`"use strict"; return (${expr})`)();
      return isNaN(res) ? 0 : Number(res.toFixed(2));
    } catch (e) {
      return value ?? 0;
    }
  };

  const calculatedVal = field.type === 'calculated' ? computeCalculatedValue() : null;

  const baseInputClass = `w-full rounded-xl border px-3 py-2 text-xs shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
    error ? 'border-destructive focus:ring-destructive' : 'border-input bg-background text-foreground'
  } ${!isEditable ? 'cursor-not-allowed opacity-60 bg-muted text-muted-foreground' : 'hover:border-primary/50'}`;

  return (
    <div className="space-y-1.5">
      {/* Label and Tooltip Header */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={field.internalName}
          className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90"
        >
          <span>{field.label}</span>
          {field.required && <span className="text-destructive font-bold">*</span>}
          {field.helpText && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 cursor-pointer text-muted-foreground hover:text-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-popover border-border text-popover-foreground">
                  <p className="max-w-xs text-xs">{field.helpText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </label>
        {field.excel?.columnName && (
          <span className="text-[10px] font-mono text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">
            Excel: {field.excel.columnName}
          </span>
        )}
      </div>

      {/* Input Control Switcher */}
      <div>{renderControl()}</div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-1 text-[11px] font-medium text-destructive mt-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );

  function renderControl() {
    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            id={field.internalName}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={!isEditable}
            placeholder={field.placeholder || ''}
            className={baseInputClass}
          />
        );

      case 'textarea':
        return (
          <textarea
            id={field.internalName}
            rows={3}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={!isEditable}
            placeholder={field.placeholder || ''}
            className={baseInputClass}
          />
        );

      case 'integer':
        return (
          <div className="relative">
            <input
              type="number"
              step="1"
              id={field.internalName}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              disabled={!isEditable}
              placeholder={field.placeholder || '0'}
              className={baseInputClass}
            />
            <Hash className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
          </div>
        );

      case 'decimal':
        return (
          <input
            type="number"
            step="0.01"
            id={field.internalName}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
            disabled={!isEditable}
            placeholder={field.placeholder || '0.00'}
            className={baseInputClass}
          />
        );

      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground">€</span>
            <input
              type="number"
              step="0.01"
              id={field.internalName}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
              disabled={!isEditable}
              placeholder={field.placeholder || '0.00'}
              className={`${baseInputClass} pl-7`}
            />
          </div>
        );

      case 'percentage':
        return (
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              id={field.internalName}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
              disabled={!isEditable}
              placeholder={field.placeholder || '0'}
              className={`${baseInputClass} pr-8`}
            />
            <Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
          </div>
        );

      case 'date':
        return (
          <div className="relative">
            <input
              type="date"
              id={field.internalName}
              value={value ? String(value).split('T')[0] : ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={!isEditable}
              className={baseInputClass}
            />
          </div>
        );

      case 'week':
        return (
          <div className="relative">
            <input
              type="week"
              id={field.internalName}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={!isEditable}
              className={baseInputClass}
            />
          </div>
        );

      case 'email':
        return (
          <div className="relative">
            <input
              type="email"
              id={field.internalName}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={!isEditable}
              placeholder={field.placeholder || 'user@stellantis.com'}
              className={`${baseInputClass} pl-9`}
            />
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
          </div>
        );

      case 'phone':
        return (
          <div className="relative">
            <input
              type="tel"
              id={field.internalName}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={!isEditable}
              placeholder={field.placeholder || '+33 1 23 45 67 89'}
              className={`${baseInputClass} pl-9`}
            />
            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
          </div>
        );

      case 'boolean':
      case 'checkbox':
        return (
          <div className="flex items-center gap-3 py-1">
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(value)}
              disabled={!isEditable}
              onClick={() => isEditable && onChange(!value)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                value ? 'bg-primary' : 'bg-muted'
              } ${!isEditable ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  value ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-xs font-semibold text-foreground">
              {value ? 'Oui / Yes' : 'Non / No'}
            </span>
          </div>
        );

      case 'dropdown':
      case 'status':
        return (
          <select
            id={field.internalName}
            value={value ?? field.defaultValue ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={!isEditable}
            className={`${baseInputClass} cursor-pointer`}
          >
            <option value="" className="bg-card text-muted-foreground">-- Select {field.label} --</option>
            {field.options?.map((opt: DropdownOption) => (
              <option key={opt.value} value={opt.value} className="bg-card text-foreground">
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2 py-1">
            {field.options?.map((opt: DropdownOption) => (
              <label key={opt.value} className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                <input
                  type="radio"
                  name={field.internalName}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={!isEditable}
                  className="h-4 w-4 text-primary border-input bg-background focus:ring-primary"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        );

      case 'user':
        return (
          <UserSelectField
            id={field.internalName}
            value={value}
            onChange={onChange}
            disabled={!isEditable}
            className={baseInputClass}
          />
        );

      case 'supplier':
        return (
          <SupplierSelectField
            id={field.internalName}
            value={value}
            onChange={onChange}
            disabled={!isEditable}
            className={baseInputClass}
          />
        );

      case 'file_upload':
        return (
          <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-input hover:border-primary rounded-xl bg-muted/20 transition-all">
            <Upload className="h-5 w-5 text-muted-foreground mb-1.5" />
            <p className="text-xs font-semibold text-foreground">
              {value ? `Selected file: ${typeof value === 'string' ? value : value.name}` : 'Drag & drop file or click to browse'}
            </p>
            <span className="text-[10px] text-muted-foreground mt-0.5">PDF, XLSX, DOCX up to 10MB</span>
            <input
              type="file"
              disabled={!isEditable}
              onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0].name)}
              className="mt-2 text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>
        );

      case 'calculated':
        return (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-primary/30 bg-primary/10 font-mono text-xs font-bold text-primary">
            <span>{calculatedVal}</span>
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">Auto-Calculated</span>
          </div>
        );

      case 'readonly':
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/40 text-xs font-medium text-foreground">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{value ?? field.defaultValue ?? 'N/A'}</span>
          </div>
        );

      default:
        return (
          <input
            type="text"
            id={field.internalName}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={!isEditable}
            className={baseInputClass}
          />
        );
    }
  }
};
