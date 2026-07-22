import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as capacityApi from '@/api/endpoints/capacity';

interface CapacityFilter {
  projectId?: string;
  supplierId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function useCapacityAssessmentsQuery(filter?: CapacityFilter) {
  return useQuery({
    queryKey: queryKeys.capacity.list(filter as Record<string, unknown>),
    queryFn: () => capacityApi.getAssessments(filter),
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

export function useCapacityAssessmentQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.capacity.detail(id),
    queryFn: () => capacityApi.getAssessment(id),
    enabled: !!id,
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

export function useCapacityCoverageQuery() {
  return useQuery({
    queryKey: queryKeys.capacity.coverage(),
    queryFn: () => capacityApi.getCoverage(),
    staleTime: 60_000,
    gcTime: 120_000,
  });
}

export function useCapacityMonthlyQuery() {
  return useQuery({
    queryKey: queryKeys.capacity.monthly(),
    queryFn: () => capacityApi.getMonthly(),
    staleTime: 60_000,
    gcTime: 120_000,
  });
}
