import { api } from '@/api/client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { Risk, CreateRiskRequest, PaginatedResponse, RiskDistribution } from '@/types';

interface RiskFilter {
  projectId?: string;
  status?: string;
  severity?: string;
  ownerId?: string;
  page?: number;
  pageSize?: number;
}

export function getRisks(filter?: RiskFilter): Promise<PaginatedResponse<Risk>> {
  return api.get<PaginatedResponse<Risk>>(API_ENDPOINTS.RISKS.BASE, {
    params: filter as Record<string, string | number | boolean | undefined>,
  });
}

export function getRisk(id: string): Promise<Risk> {
  return api.get<Risk>(API_ENDPOINTS.RISKS.BY_ID(id));
}

export function createRisk(data: CreateRiskRequest): Promise<Risk> {
  return api.post<Risk>(API_ENDPOINTS.RISKS.BASE, data);
}

export function updateRisk(id: string, data: Partial<CreateRiskRequest>): Promise<Risk> {
  return api.put<Risk>(API_ENDPOINTS.RISKS.BY_ID(id), data);
}

export function deleteRisk(id: string): Promise<void> {
  return api.delete<void>(API_ENDPOINTS.RISKS.BY_ID(id));
}

export function mitigateRisk(id: string, mitigationPlan?: string): Promise<Risk> {
  return api.post<Risk>(API_ENDPOINTS.RISKS.MITIGATE(id), { mitigationPlan });
}

export function closeRisk(id: string): Promise<Risk> {
  return api.post<Risk>(API_ENDPOINTS.RISKS.CLOSE(id));
}

export function getDistribution(): Promise<RiskDistribution[]> {
  return api.get<RiskDistribution[]>(API_ENDPOINTS.RISKS.DISTRIBUTION);
}
