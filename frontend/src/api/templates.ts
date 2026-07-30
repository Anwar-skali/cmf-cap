import { api } from './client';
import { CMFTemplate } from '@/types/template';

// NOTE: All paths here are relative to API_BASE_URL (/api/v1).
// Do NOT include /api/v1 prefix — the api client adds it automatically.

export const templatesApi = {
  getTemplates: async (): Promise<{ items: CMFTemplate[]; total: number }> => {
    return api.get('/templates');
  },

  getTemplateById: async (id: string): Promise<CMFTemplate> => {
    return api.get(`/templates/${id}`);
  },

  getTemplateByCode: async (code: string): Promise<CMFTemplate> => {
    return api.get(`/templates/code/${code}`);
  },

  createTemplate: async (data: {
    code: string;
    name: string;
    description?: string;
    version?: string;
    status?: string;
    schema_json: any;
  }): Promise<CMFTemplate> => {
    return api.post('/templates', data);
  },

  updateTemplate: async (
    id: string,
    data: {
      name?: string;
      description?: string;
      status?: string;
      schema_json?: any;
      change_log?: string;
    }
  ): Promise<CMFTemplate> => {
    return api.put(`/templates/${id}`, data);
  },

  duplicateTemplate: async (id: string): Promise<CMFTemplate> => {
    return api.post(`/templates/${id}/duplicate`);
  },

  publishTemplate: async (id: string): Promise<CMFTemplate> => {
    return api.post(`/templates/${id}/publish`);
  },

  archiveTemplate: async (id: string): Promise<CMFTemplate> => {
    return api.post(`/templates/${id}/archive`);
  },

  deleteTemplate: async (id: string): Promise<{ success: boolean }> => {
    return api.delete(`/templates/${id}`);
  },

  importTemplateJson: async (rawJson: any): Promise<CMFTemplate> => {
    return api.post('/templates/import', rawJson);
  },

  exportTemplateJson: async (id: string): Promise<any> => {
    return api.get(`/templates/${id}/export`);
  },
};
