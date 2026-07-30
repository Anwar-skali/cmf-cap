import React, { createContext, useContext, useEffect, useState } from 'react';
import { CMFTemplate, TemplateSection } from '@/types/template';
import { templatesApi } from '@/api/templates';

interface TemplateContextType {
  templates: CMFTemplate[];
  activeTemplate: CMFTemplate | null;
  isLoading: boolean;
  error: string | null;
  setActiveTemplate: (template: CMFTemplate | null) => void;
  fetchTemplates: () => Promise<void>;
  loadTemplateByCode: (code: string) => Promise<CMFTemplate | null>;
}

const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

const normalizeTemplate = (tmpl: any): CMFTemplate => {
  const sections: TemplateSection[] = tmpl.schemaJson?.sections || tmpl.schema_json?.sections || tmpl.sections || [];
  const dashboardConfig = tmpl.schemaJson?.dashboardConfig || tmpl.schema_json?.dashboardConfig || tmpl.dashboardConfig;
  const searchConfig = tmpl.schemaJson?.searchConfig || tmpl.schema_json?.searchConfig || tmpl.searchConfig;
  return { ...tmpl, sections, dashboardConfig, searchConfig };
};

export const TemplateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [templates, setTemplates] = useState<CMFTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<CMFTemplate | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await templatesApi.getTemplates();
      const items = (res.items || []).map(normalizeTemplate);
      setTemplates(items);

      // Default active template to K9 or first published template
      if (!activeTemplate && items.length > 0) {
        const k9 = items.find((t) => t.code.toUpperCase() === 'K9') || items[0];
        setActiveTemplate(k9);
      }
    } catch (err: any) {
      console.error('Failed to fetch templates:', err);
      setError(err?.message || 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplateByCode = async (code: string): Promise<CMFTemplate | null> => {
    try {
      setIsLoading(true);
      const tmpl = normalizeTemplate(await templatesApi.getTemplateByCode(code));
      setActiveTemplate(tmpl);
      return tmpl;
    } catch (err) {
      console.error(`Failed to load template ${code}:`, err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  return (
    <TemplateContext.Provider
      value={{
        templates,
        activeTemplate,
        isLoading,
        error,
        setActiveTemplate,
        fetchTemplates,
        loadTemplateByCode,
      }}
    >
      {children}
    </TemplateContext.Provider>
  );
};

export const useTemplate = () => {
  const context = useContext(TemplateContext);
  if (!context) {
    throw new Error('useTemplate must be used within a TemplateProvider');
  }
  return context;
};
