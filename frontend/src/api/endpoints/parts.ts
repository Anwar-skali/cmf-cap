import { api } from '@/api/client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { ProjectPart, CreateProjectPartRequest, PaginatedResponse } from '@/types';

interface PartFilter {
  projectId?: string;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function getParts(filter?: PartFilter): Promise<PaginatedResponse<ProjectPart>> {
  return api.get<PaginatedResponse<ProjectPart>>(API_ENDPOINTS.PARTS.BASE, {
    params: filter as Record<string, string | number | boolean | undefined>,
  });
}

export function getPart(id: string): Promise<ProjectPart> {
  return api.get<ProjectPart>(API_ENDPOINTS.PARTS.BY_ID(id));
}

export function createPart(data: CreateProjectPartRequest): Promise<ProjectPart> {
  return api.post<ProjectPart>(API_ENDPOINTS.PARTS.BASE, data);
}

export function updatePart(id: string, data: Partial<CreateProjectPartRequest>): Promise<ProjectPart> {
  return api.put<ProjectPart>(API_ENDPOINTS.PARTS.BY_ID(id), data);
}

export function deletePart(id: string): Promise<void> {
  return api.delete<void>(API_ENDPOINTS.PARTS.BY_ID(id));
}
