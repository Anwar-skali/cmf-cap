import { api } from '@/api/client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { CapacityAssessment, CreateCapacityAssessmentRequest, PaginatedResponse, CapacityCoverage, MonthlyCapacity } from '@/types';

interface CapacityFilter {
  projectId?: string;
  supplierId?: string;
  projectPartId?: string;
  status?: string;
  gate?: string;
  riskLevel?: string;
  month?: number;
  year?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function getAssessments(filter?: CapacityFilter): Promise<PaginatedResponse<CapacityAssessment>> {
  return api.get<PaginatedResponse<CapacityAssessment>>(API_ENDPOINTS.CAPACITY.BASE, {
    params: filter as Record<string, string | number | boolean | undefined>,
  });
}

export function getAssessment(id: string): Promise<CapacityAssessment> {
  return api.get<CapacityAssessment>(API_ENDPOINTS.CAPACITY.BY_ID(id));
}

export function createAssessment(data: CreateCapacityAssessmentRequest): Promise<CapacityAssessment> {
  return api.post<CapacityAssessment>(API_ENDPOINTS.CAPACITY.BASE, data);
}

export function updateAssessment(id: string, data: Partial<CreateCapacityAssessmentRequest>): Promise<CapacityAssessment> {
  return api.put<CapacityAssessment>(API_ENDPOINTS.CAPACITY.BY_ID(id), data);
}

export function deleteAssessment(id: string): Promise<void> {
  return api.delete<void>(API_ENDPOINTS.CAPACITY.BY_ID(id));
}

export function getCoverage(): Promise<CapacityCoverage[]> {
  return api.get<CapacityCoverage[]>(API_ENDPOINTS.CAPACITY.COVERAGE);
}

export function getMonthly(year: number, month: number): Promise<MonthlyCapacity[]> {
  return api.get<MonthlyCapacity[]>(API_ENDPOINTS.CAPACITY.MONTHLY(year, month));
}
