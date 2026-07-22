import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as risksApi from '@/api/endpoints/risks';

interface RiskFilter {
  projectId?: string;
  status?: string;
  severity?: string;
  ownerId?: string;
  page?: number;
  pageSize?: number;
}

export function useRisksQuery(filter?: RiskFilter) {
  return useQuery({
    queryKey: queryKeys.risks.list(filter as Record<string, unknown>),
    queryFn: () => risksApi.getRisks(filter),
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

export function useRiskQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.risks.detail(id),
    queryFn: () => risksApi.getRisk(id),
    enabled: !!id,
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

export function useRiskDistributionQuery() {
  return useQuery({
    queryKey: queryKeys.risks.distribution(),
    queryFn: () => risksApi.getDistribution(),
    staleTime: 60_000,
    gcTime: 120_000,
  });
}
