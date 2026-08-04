import { api } from '@/api/client';

const TOKEN_KEY = 'cmf_access_token';

export interface ImportSchemaColumn {
  key: string;
  label: string;
  required: boolean;
  type: string;
  enumValues?: string[];
  description?: string;
}

export interface ImportSchema {
  entityType: string;
  displayName: string;
  columns: ImportSchemaColumn[];
}

export interface ValidationError {
  rowIndex: number;
  columnName: string;
  fieldKey: string;
  rawValue: any;
  errorType: string;
  message: string;
}

export interface ImportPreviewReport {
  entityType: string;
  entityDisplayName: string;
  fileName: string;
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  headers: string[];
  columnMapping: Record<string, string | null>;
  availableSchemaColumns: ImportSchemaColumn[];
  validationErrors: ValidationError[];
  previewRows: Record<string, any>[];
}

export interface ImportExecutionResult {
  id: string;
  entityType: string;
  fileName: string;
  totalRows: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  durationMs: number;
  status: string;
  message: string;
}

export interface ImportHistoryRecord {
  id: string;
  entityType: string;
  fileName: string;
  fileSize: number;
  userEmail: string;
  totalRows: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  durationMs: number;
  mode: string;
  strategy: string;
  status: string;
  errorsSummary?: ValidationError[];
  createdAt: string;
}

export async function getImportSchemas(): Promise<ImportSchema[]> {
  return api.get<ImportSchema[]>('/import/schemas');
}

export async function previewImport(
  file: File,
  entityType: string,
  customMapping?: Record<string, string>,
): Promise<ImportPreviewReport> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entity_type', entityType);
  if (customMapping) {
    formData.append('custom_mapping_json', JSON.stringify(customMapping));
  }

  // Use api.upload() so FormData is sent correctly with auth headers
  return api.upload<ImportPreviewReport>('/import/preview', formData);
}

export async function executeImport(
  file: File,
  entityType: string,
  columnMapping: Record<string, string>,
  mode: 'insert' | 'upsert' = 'insert',
  strategy: 'skip_invalid' | 'rollback_all' = 'skip_invalid',
): Promise<ImportExecutionResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entity_type', entityType);
  formData.append('mode', mode);
  formData.append('strategy', strategy);
  formData.append('column_mapping_json', JSON.stringify(columnMapping));

  // Use api.upload() so FormData is sent correctly with auth headers
  return api.upload<ImportExecutionResult>('/import/execute', formData);
}

export async function getImportHistory(limit = 50): Promise<ImportHistoryRecord[]> {
  return api.get<ImportHistoryRecord[]>(`/import/history?limit=${limit}`);
}

export async function downloadTemplateFile(entityType: string): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const response = await fetch(`/api/v1/import/template/${entityType}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download template: ${response.statusText}`);
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${entityType}_import_template.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function downloadErrorReport(errors: ValidationError[], fileName: string): Promise<Blob> {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  // Convert camelCase ValidationError back to snake_case for the backend
  const errorsSnakeCase = errors.map((e) => ({
    row_index: e.rowIndex,
    column_name: e.columnName,
    field_key: e.fieldKey,
    raw_value: e.rawValue,
    error_type: e.errorType,
    message: e.message,
  }));

  const formData = new FormData();
  formData.append('errors_json', JSON.stringify(errorsSnakeCase));
  formData.append('file_name', fileName);

  const response = await fetch('/api/v1/import/export-errors', {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to download error report');
  }

  return response.blob();
}

export async function downloadDocument(documentId: string, fileName: string): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const response = await fetch(`/api/v1/documents/${documentId}/download`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download document: ${response.statusText}`);
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// RAG / Ollama Import Workflow Types & API
// ─────────────────────────────────────────────

export interface ImportTemplate {
  id: string;
  code: string;
  name: string;
  description: string;
  version: string;
  status: string;
}

export interface FieldDefinition {
  key: string;
  label: string;
  description: string;
  required: boolean;
  type: string;
  aliases: string[];
}

export interface OllamaMappingItem {
  excel: string | null;
  confidence: number;
  source: 'ollama_llm' | 'mapping_memory' | 'exact_match' | 'alias_match' | 'fuzzy_fallback' | 'none';
}

export interface OllamaExecutionTimes {
  headerResolutionMs?: number;
  templateLoadingMs?: number;
  ollamaResponseTimeMs?: number;
  totalMappingMs?: number;
}

export interface OllamaMappingResult {
  templateCode: string;
  templateName: string;
  excelHeaders: string[];
  mapping: Record<string, OllamaMappingItem>;
  promptUsed: string;
  ollamaActive: boolean;
  ollamaReachable?: boolean;
  executionTimes?: OllamaExecutionTimes;
  model: string;
  fieldDefinitions: FieldDefinition[];
}

export interface ExtractedHeaders {
  fileName: string;
  headerCount: number;
  headers: string[];
  extractionDurationMs?: number;
}

/** Fetch project templates available for import selection (K0, K9, etc.) */
export async function getImportTemplates(): Promise<ImportTemplate[]> {
  return api.get<ImportTemplate[]>('/import/import-templates');
}

/** Extract only Excel column headers from an uploaded file (no row data) */
export async function extractExcelHeaders(file: File): Promise<ExtractedHeaders> {
  const formData = new FormData();
  formData.append('file', file);
  return api.upload<ExtractedHeaders>('/import/extract-headers', formData);
}

/** Run RAG semantic mapping via local Ollama for given template + Excel headers */
export async function generateOllamaMapping(
  templateIdentifier: string,
  excelHeaders: string[],
  file?: File,
): Promise<OllamaMappingResult> {
  const formData = new FormData();
  formData.append('template_identifier', templateIdentifier);
  formData.append('headers_json', JSON.stringify(excelHeaders));
  // Only attach file if headers are empty
  if (file && excelHeaders.length === 0) formData.append('file', file);
  return api.upload<OllamaMappingResult>('/import/ollama-map', formData);
}

/** Persist confirmed mapping to the server-side mapping memory cache */
export async function saveMappingMemory(
  templateCode: string,
  mapping: Record<string, string>,
): Promise<{ success: boolean; saved_count: number }> {
  const formData = new FormData();
  formData.append('template_code', templateCode);
  formData.append('mapping_json', JSON.stringify(mapping));
  return api.upload<{ success: boolean; saved_count: number }>('/import/save-mapping-memory', formData);
}
