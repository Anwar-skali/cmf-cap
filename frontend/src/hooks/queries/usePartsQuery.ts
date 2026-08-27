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
  // Build a stable key: always include the filter object (even if empty/undefined)
  // so that mutations invalidating queryKeys.parts.lists() correctly match.
  const filterKey = filter ?? {};
  return useQuery({
    queryKey: [...queryKeys.parts.lists(), filterKey] as const,
    queryFn: () => partsApi.getParts(filter),
    staleTime: 0,      // always re-fetch after invalidation
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
