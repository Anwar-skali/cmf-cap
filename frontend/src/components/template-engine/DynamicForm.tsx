import React, { useState, useEffect, useRef } from 'react';
import { CMFTemplate, TemplateSection, TemplateField, ConditionalRule } from '@/types/template';
import { FieldRenderer } from './fields/FieldRenderer';
import { ChevronDown, ChevronRight, Save, RotateCcw, CheckCircle2, AlertCircle, Layers, FileText, Activity, ShieldAlert, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DynamicFormProps {
  template: CMFTemplate;
  initialValues?: Record<string, any>;
  onSave: (values: Record<string, any>) => void | Promise<void>;
  userRole?: string;
  isSaving?: boolean;
  title?: string;
  readOnly?: boolean;
  onCancel?: () => void;
}

// ── Role-permission helpers ───────────────────────────────────────────────

/** Normalise a raw role string to the canonical project-role key. */
function normaliseRole(raw: string): string {
  const r = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (r === 'buyer' || r === 'purchasing') return 'buyer';
  if (r === 'capacity_manager' || r === 'capacity' || r === 'capacitymanager' || r === 'cap_manager') return 'capacity_manager';
  if (r === 'sqd' || r === 'quality' || r === 'sqd_team' || r === 'quality_lead') return 'sqd';
  if (r === 'admin' || r === 'administrator') return 'admin';
  return r;
}

/** Returns true when the current user may edit a field. */
function canEditField(field: TemplateField, userRole: string): boolean {
  if (userRole === 'admin') return true;
  const allowed = field.permissions?.rolesAllowedToEdit;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(userRole);
}

/** Returns true when the current user may view a section. */
function canViewSection(section: TemplateSection, userRole: string): boolean {
  if (userRole === 'admin') return true;
  const allowed = section.permissions?.rolesAllowedToView;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(userRole);
}

/** Returns true when the current user may edit the section (any of its fields). */
function canEditSectionRole(section: TemplateSection, userRole: string): boolean {
  if (userRole === 'admin') return true;
  const allowed = section.permissions?.rolesAllowedToEdit;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(userRole);
}

const ROLE_DISPLAY: Record<string, { label: string; cls: string }> = {
  buyer:            { label: 'Buyer',            cls: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' },
  capacity_manager: { label: 'Capacity Manager', cls: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' },
  sqd:              { label: 'SQD',              cls: 'text-violet-600 bg-violet-50 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700' },
  admin:            { label: 'Admin',            cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
};

export const DynamicForm: React.FC<DynamicFormProps> = ({
  template,
  initialValues = {},
  onSave,
  userRole: rawUserRole = 'admin',
  isSaving = false,
  title,
  readOnly = false,
  onCancel,
}) => {
  // Normalise so 'Capacity Manager', 'capacity_manager', 'cap_manager' → same key
  const userRole = normaliseRole(rawUserRole);

  const [formValues, setFormValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Ref to track initial values by value to avoid infinite loops
  const initValuesSnapshot = useRef(initialValues);

  // Initialize section collapse state and default field values
  useEffect(() => {
    const initialOpenState: Record<string, boolean> = {};
    const defaults: Record<string, any> = { ...initValuesSnapshot.current };

    template.sections?.forEach((sec, idx) => {
      initialOpenState[sec.id] = idx < 3;

      sec.groups?.forEach((grp) => {
        grp.fields?.forEach((fld) => {
          if (defaults[fld.internalName] === undefined && fld.defaultValue !== undefined) {
            defaults[fld.internalName] = fld.defaultValue;
          }
        });
      });
    });

    setOpenSections(initialOpenState);
    setFormValues(defaults);
  }, [template]);

  // Handle Field Value Change
  const handleFieldChange = (internalName: string, val: any) => {
    setIsDirty(true);
    setFormValues((prev) => {
      const next = { ...prev, [internalName]: val };
      validateField(internalName, val, next);
      return next;
    });
  };

  // Evaluate Conditional Rule
  const evaluateCondition = (rule: ConditionalRule, currentValues: Record<string, any>): boolean => {
    const targetVal = currentValues[rule.field];
    switch (rule.operator) {
      case 'equals':
        return targetVal === rule.value;
      case 'not_equals':
        return targetVal !== rule.value;
      case 'in':
        return Array.isArray(rule.value) && rule.value.includes(targetVal);
      case 'not_in':
        return Array.isArray(rule.value) && !rule.value.includes(targetVal);
      case 'greater_than':
        return Number(targetVal) > Number(rule.value);
      case 'less_than':
        return Number(targetVal) < Number(rule.value);
      default:
        return true;
    }
  };

  // Determine Field Visibility based on conditional rules
  const isFieldVisible = (field: TemplateField, currentValues: Record<string, any>): boolean => {
    if (field.visible === false) return false;
    if (!field.conditions || field.conditions.length === 0) return true;

    return field.conditions.every((rule) => {
      const match = evaluateCondition(rule, currentValues);
      return rule.type === 'show' ? match : !match;
    });
  };

  // Validate Field
  const validateField = (internalName: string, val: any, currentValues: Record<string, any>): boolean => {
    let fieldObj: TemplateField | null = null;

    template.sections?.forEach((sec) => {
      sec.groups?.forEach((grp) => {
        grp.fields?.forEach((fld) => {
          if (fld.internalName === internalName) fieldObj = fld;
        });
      });
    });

    if (!fieldObj) return true;
    const fld: TemplateField = fieldObj;

    if (!isFieldVisible(fld, currentValues)) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[internalName];
        return copy;
      });
      return true;
    }

    if (fld.required && (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0))) {
      setErrors((prev) => ({ ...prev, [internalName]: `${fld.label} is required` }));
      return false;
    }

    if (fld.validation && val !== undefined && val !== '') {
      const v = fld.validation;
      if (v.type === 'minLength' && String(val).length < Number(v.value)) {
        setErrors((prev) => ({ ...prev, [internalName]: v.message || `Minimum ${v.value} characters required` }));
        return false;
      }
      if (v.type === 'maxLength' && String(val).length > Number(v.value)) {
        setErrors((prev) => ({ ...prev, [internalName]: v.message || `Maximum ${v.value} characters allowed` }));
        return false;
      }
      if (v.type === 'regex' && v.value && !new RegExp(v.value).test(String(val))) {
        setErrors((prev) => ({ ...prev, [internalName]: v.message || `Invalid format` }));
        return false;
      }
    }

    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[internalName];
      return copy;
    });

    return true;
  };

  // Validate Entire Form — only validates sections/fields actually present in the template prop
  const validateAll = (): boolean => {
    let isValid = true;
    const newErrors: Record<string, string> = {};

    template.sections?.forEach((sec) => {
      // Skip sections the user cannot view
      if (!canViewSection(sec, userRole)) return;

      sec.groups?.forEach((grp) => {
        grp.fields?.forEach((fld) => {
          // Skip fields that are conditionally hidden or not editable by current user role
          if (!isFieldVisible(fld, formValues)) return;
          if (!canEditField(fld, userRole)) return;

          const val = formValues[fld.internalName];
          if (fld.required && (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0))) {
            newErrors[fld.internalName] = `${fld.label} is required`;
            isValid = false;
          }
        });
      });
    });

    setErrors(newErrors);
    // Auto-open sections that have errors so users can see them
    if (!isValid) {
      setOpenSections((prev) => {
        const next = { ...prev };
        Object.keys(newErrors).forEach((fieldName) => {
          template.sections?.forEach((sec) => {
            sec.groups?.forEach((grp) => {
              if (grp.fields?.some((f) => f.internalName === fieldName)) {
                next[sec.id] = true;
              }
            });
          });
        });
        return next;
      });
    }
    return isValid;
  };

  // Calculate Progress Percentage
  const calculateProgress = (): number => {
    let totalFields = 0;
    let completedFields = 0;

    template.sections?.forEach((sec) => {
      sec.groups?.forEach((grp) => {
        grp.fields?.forEach((fld) => {
          if (isFieldVisible(fld, formValues)) {
            totalFields++;
            const val = formValues[fld.internalName];
            if (val !== undefined && val !== null && val !== '') completedFields++;
          }
        });
      });
    });

    return totalFields === 0 ? 100 : Math.round((completedFields / totalFields) * 100);
  };

  const progress = calculateProgress();

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;
    await onSave(formValues);
    setIsDirty(false);
    setLastSavedTime(new Date().toLocaleTimeString());
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6 pb-20">
      {/* Header & Progress Indicator */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">
                {title || template.name}
              </h2>
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                Template {template.code} v{template.version}
              </span>
            </div>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
            )}
          </div>

          {/* Completion Meter */}
          <div className="flex items-center gap-4 bg-background p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4 text-xs font-semibold">
                <span className="text-muted-foreground">Form Completion</span>
                <span className="font-bold text-blue-600">{progress}%</span>
              </div>
              <div className="h-2 w-36 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full bg-blue-600 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sections Accordion */}
      <div className="space-y-4">
        {template.sections?.map((section, idx) => {
          // Hide sections the user has no view access to
          if (!canViewSection(section, userRole)) return null;

          const sectionEditable = canEditSectionRole(section, userRole);
          const sectionEditRoles = section.permissions?.rolesAllowedToEdit ?? [];
          const ownerRole = sectionEditRoles.find((r) => r !== 'admin') ?? null;

          const isOpen = openSections[section.id] ?? false;

          let fieldCount = 0;
          section.groups?.forEach((g) => {
            g.fields?.forEach((f) => {
              if (isFieldVisible(f, formValues)) fieldCount++;
            });
          });

          return (
            <div
              key={section.id}
              className={`rounded-2xl border bg-card shadow-xs overflow-hidden transition-all duration-200 ${
                !sectionEditable
                  ? 'border-slate-300/70 dark:border-slate-700/70 opacity-90'
                  : 'border-slate-300 dark:border-slate-700'
              }`}
            >
              {/* Section Header Bar */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 sm:p-5 bg-card hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors text-left focus:outline-none cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      isOpen
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-400 dark:border-slate-600 bg-background text-muted-foreground group-hover:border-blue-500'
                    }`}
                  >
                    <span className="text-xs font-bold">{idx + 1}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground group-hover:text-blue-600 transition-colors flex items-center gap-2.5 flex-wrap">
                      <span>{section.name}</span>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                        {fieldCount} fields
                      </span>
                      {/* Role-restriction badge */}
                      {!sectionEditable && ownerRole && ROLE_DISPLAY[ownerRole] && (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${ROLE_DISPLAY[ownerRole].cls}`}>
                          <Lock className="h-2.5 w-2.5" />
                          {ROLE_DISPLAY[ownerRole].label} only
                        </span>
                      )}
                    </h3>
                    {section.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{section.description}</p>
                    )}
                  </div>
                </div>
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                )}
              </button>

              {/* Section Content */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="p-5 space-y-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20"
                  >
                    {/* Read-only section notice */}
                    {!sectionEditable && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span>
                          This section is managed by{' '}
                          <strong>{ownerRole ? (ROLE_DISPLAY[ownerRole]?.label ?? ownerRole) : 'another role'}</strong>.
                          You can view these fields but cannot modify them.
                        </span>
                      </div>
                    )}

                    {section.groups?.map((group) => (
                      <div
                        key={group.id}
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-card p-5 space-y-4 transition-all duration-200 hover:border-blue-400/80 hover:shadow-xs"
                      >
                        <div className="border-b border-slate-200 dark:border-slate-800 pb-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                            <div>
                              <h4 className="text-sm font-bold text-foreground hover:text-blue-600 transition-colors">
                                {group.name}
                              </h4>
                              {group.description && (
                                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                                  {group.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                            {group.fields?.length || 0} fields
                          </span>
                        </div>

                        {/* Grid Layout for Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {group.fields?.map((field) => {
                            if (!isFieldVisible(field, formValues)) return null;

                            // Disabled when: global readOnly OR this specific field is not editable by this role
                            const fieldEditable = canEditField(field, userRole);
                            const isFieldDisabled = readOnly || !fieldEditable;
                            const fieldEditRoles = field.permissions?.rolesAllowedToEdit ?? [];
                            const fieldOwnerRole = fieldEditRoles.find((r) => r !== 'admin') ?? null;

                            return (
                              <div key={field.id} className="space-y-0.5">
                                <FieldRenderer
                                  field={field}
                                  value={formValues[field.internalName]}
                                  onChange={(val) => handleFieldChange(field.internalName, val)}
                                  disabled={isFieldDisabled}
                                  error={errors[field.internalName]}
                                  formValues={formValues}
                                  userRole={userRole}
                                />
                                {/* Per-field lock badge */}
                                {!fieldEditable && fieldOwnerRole && ROLE_DISPLAY[fieldOwnerRole] && (
                                  <span
                                    className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-px text-[9px] font-bold ${ROLE_DISPLAY[fieldOwnerRole].cls}`}
                                    title={`Only ${ROLE_DISPLAY[fieldOwnerRole].label} can edit this field`}
                                  >
                                    <Lock className="h-2 w-2" /> {ROLE_DISPLAY[fieldOwnerRole].label} only
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>


      {/* LTOS Bottom Right Action Bar */}
      {!readOnly && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {isDirty ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                <AlertCircle className="h-4 w-4" /> Unsaved changes
              </span>
            ) : lastSavedTime ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                <CheckCircle2 className="h-4 w-4" /> Saved at {lastSavedTime}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Ready</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onCancel ? onCancel : () => setFormValues(initialValues)}
              disabled={isSaving}
              className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer transition-all"
            >
              Back
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-bold px-8 py-2.5 transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Next</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </form>
  );
};

