import { api } from '@/api/client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { Project, ProjectFilter, CreateProjectRequest, PaginatedResponse } from '@/types';

export function getProjects(filter?: ProjectFilter): Promise<PaginatedResponse<Project>> {
  return api.get<PaginatedResponse<Project>>(API_ENDPOINTS.PROJECTS.BASE, {
    params: filter as Record<string, string | number | boolean | undefined>,
  });
}

export function getProject(id: string): Promise<Project> {
  return api.get<Project>(API_ENDPOINTS.PROJECTS.BY_ID(id));
}

export function createProject(data: CreateProjectRequest): Promise<Project> {
  return api.post<Project>(API_ENDPOINTS.PROJECTS.BASE, data);
}

export function updateProject(id: string, data: Partial<CreateProjectRequest>): Promise<Project> {
  return api.put<Project>(API_ENDPOINTS.PROJECTS.BY_ID(id), data);
}

export function deleteProject(id: string): Promise<void> {
  return api.delete<void>(API_ENDPOINTS.PROJECTS.BY_ID(id));
}

export function updateProjectStatus(id: string, status: string): Promise<Project> {
  return api.patch<Project>(API_ENDPOINTS.PROJECTS.STATUS(id), { status });
}

export function bulkDeleteProjects(projectIds: string[]): Promise<{ deleted_count: number; deleted_ids: string[] }> {
  return api.post<{ deleted_count: number; deleted_ids: string[] }>(API_ENDPOINTS.PROJECTS.BULK_DELETE, {
    project_ids: projectIds,
  });
}
