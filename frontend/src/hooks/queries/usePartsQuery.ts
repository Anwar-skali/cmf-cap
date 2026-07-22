import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as partsApi from '@/api/endpoints/parts';

interface PartFilter {
  projectId?: string;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function usePartsQuery(filter?: PartFilter) {
  return useQuery({
    queryKey: queryKeys.parts.list(filter as Record<string, unknown>),
    queryFn: () => partsApi.getParts(filter),
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

export function usePartQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.parts.detail(id),
    queryFn: () => partsApi.getPart(id),
    enabled: !!id,
    staleTime: 30_000,
    gcTime: 60_000,
  });
}
