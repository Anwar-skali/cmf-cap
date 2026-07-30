import React, { useState, useEffect, useRef } from 'react';
import { CMFTemplate, TemplateSection, TemplateField, ConditionalRule } from '@/types/template';
import { FieldRenderer } from './fields/FieldRenderer';
import { ChevronDown, ChevronRight, Save, RotateCcw, CheckCircle2, AlertCircle, Layers, FileText, Activity } from 'lucide-react';
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

export const DynamicForm: React.FC<DynamicFormProps> = ({
  template,
  initialValues = {},
  onSave,
  userRole = 'admin',
  isSaving = false,
  title,
  readOnly = false,
  onCancel,
}) => {
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
      sec.groups?.forEach((grp) => {
        grp.fields?.forEach((fld) => {
          // Skip fields that are conditionally hidden
          if (!isFieldVisible(fld, formValues)) return;
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
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card shadow-sm overflow-hidden transition-all duration-200"
            >
              {/* Section Header Bar */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 bg-slate-50/70 dark:bg-slate-900/60 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors text-left focus:outline-none cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 font-extrabold text-xs">
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <span>{section.name}</span>
                      <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-muted-foreground">
                        {fieldCount} fields
                      </span>
                    </h3>
                    {section.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                    )}
                  </div>
                </div>
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
                    className="p-5 space-y-6 border-t border-slate-200 dark:border-slate-800"
                  >
                    {section.groups?.map((group) => (
                      <div key={group.id} className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-background p-4 space-y-4 shadow-2xs">
                        <div className="border-b border-border/40 pb-2">
                          <h4 className="text-sm font-bold text-foreground">{group.name}</h4>
                          {group.description && (
                            <p className="text-[11px] text-muted-foreground">{group.description}</p>
                          )}
                        </div>

                        {/* Grid Layout for Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {group.fields?.map((field) => {
                            if (!isFieldVisible(field, formValues)) return null;

                            return (
                              <FieldRenderer
                                key={field.id}
                                field={field}
                                value={formValues[field.internalName]}
                                onChange={(val) => handleFieldChange(field.internalName, val)}
                                disabled={readOnly}
                                error={errors[field.internalName]}
                                formValues={formValues}
                                userRole={userRole}
                              />
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

