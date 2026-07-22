import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as suppliersApi from '@/api/endpoints/suppliers';
import type { SupplierFilter } from '@/types';

export function useSuppliersQuery(filter?: SupplierFilter) {
  return useQuery({
    queryKey: queryKeys.suppliers.list(filter as Record<string, unknown>),
    queryFn: () => suppliersApi.getSuppliers(filter),
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

export function useSupplierQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.suppliers.detail(id),
    queryFn: () => suppliersApi.getSupplier(id),
    enabled: !!id,
    staleTime: 30_000,
    gcTime: 60_000,
  });
}
