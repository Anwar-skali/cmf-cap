import { api } from '@/api/client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { Document, PaginatedResponse } from '@/types';

interface DocumentFilter {
  projectId?: string;
  partId?: string;
  supplierId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

export function getDocuments(filter?: DocumentFilter): Promise<PaginatedResponse<Document>> {
  return api.get<PaginatedResponse<Document>>(API_ENDPOINTS.DOCUMENTS.BASE, {
    params: filter as Record<string, string | number | boolean | undefined>,
  });
}

export function getDocument(id: string): Promise<Document> {
  return api.get<Document>(API_ENDPOINTS.DOCUMENTS.BY_ID(id));
}

export function downloadDocument(id: string): Promise<Blob> {
  return api.get<Blob>(API_ENDPOINTS.DOCUMENTS.DOWNLOAD(id));
}

export function deleteDocument(id: string): Promise<void> {
  return api.delete<void>(API_ENDPOINTS.DOCUMENTS.BY_ID(id));
}

export function uploadDocument(file: File, metadata: {
  projectId?: string;
  partId?: string;
  supplierId?: string;
  name: string;
  type: string;
  description?: string;
}): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', metadata.name);
  formData.append('type', metadata.type);
  if (metadata.projectId) formData.append('projectId', metadata.projectId);
  if (metadata.partId) formData.append('partId', metadata.partId);
  if (metadata.supplierId) formData.append('supplierId', metadata.supplierId);
  if (metadata.description) formData.append('description', metadata.description);

  return api.upload<Document>(API_ENDPOINTS.DOCUMENTS.UPLOAD, formData);
}
