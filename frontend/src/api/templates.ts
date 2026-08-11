import { api } from './client';
import { API_BASE_URL } from '@/lib/constants';
import { CMFTemplate } from '@/types/template';

// NOTE: All paths here are relative to API_BASE_URL (/api/v1).
// Do NOT include /api/v1 prefix — the api client adds it automatically.

const TOKEN_KEY = 'cmf_access_token';

/**
 * Posts a JSON body to the backend WITHOUT snake_case transformation.
 * Required when the payload contains a `schema_json` domain blob whose inner
 * keys must be preserved exactly as authored (e.g. `internalName`, `helpText`,
 * `defaultValue`) — the shared `api.post()` converts those to snake_case.
 */
async function rawJsonPost<T>(url: string, body: unknown): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody?.detail) {
        message =
          typeof errBody.detail === 'string'
            ? errBody.detail
            : errBody.detail?.message || message;
      } else if (errBody?.message) {
        message = errBody.message;
      } else if (errBody?.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // ignore parse errors, keep default message
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

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

  /**
   * Creates a Template (Project Structure) sending the full body verbatim —
   * preserves camelCase keys inside `schema_json` (internalName, helpText, etc.)
   */
  createStructureTemplate: async (data: {
    code: string;
    name: string;
    description?: string;
    version?: string;
    status?: string;
    schema_json: any;
  }): Promise<CMFTemplate> => {
    return rawJsonPost<CMFTemplate>('/templates', data);
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

  /**
   * Imports a Template (Project Structure) from raw JSON verbatim.
   */
  importTemplateRawJson: async (rawJson: any): Promise<CMFTemplate> => {
    return rawJsonPost<CMFTemplate>('/templates/import', rawJson);
  },

  exportTemplateJson: async (id: string): Promise<any> => {
    return api.get(`/templates/${id}/export`);
  },
};
