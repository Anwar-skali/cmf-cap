import { api } from '@/api/client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { Supplier, SupplierFilter, CreateSupplierRequest, PaginatedResponse } from '@/types';

export function getSuppliers(filter?: SupplierFilter): Promise<PaginatedResponse<Supplier>> {
  return api.get<PaginatedResponse<Supplier>>(API_ENDPOINTS.SUPPLIERS.BASE, {
    params: filter as Record<string, string | number | boolean | undefined>,
  });
}

export function getSupplier(id: string): Promise<Supplier> {
  return api.get<Supplier>(API_ENDPOINTS.SUPPLIERS.BY_ID(id));
}

export function createSupplier(data: CreateSupplierRequest): Promise<Supplier> {
  return api.post<Supplier>(API_ENDPOINTS.SUPPLIERS.BASE, data);
}

export function updateSupplier(id: string, data: Partial<CreateSupplierRequest>): Promise<Supplier> {
  return api.put<Supplier>(API_ENDPOINTS.SUPPLIERS.BY_ID(id), data);
}

export function deleteSupplier(id: string): Promise<void> {
  return api.delete<void>(API_ENDPOINTS.SUPPLIERS.BY_ID(id));
}

export function assignToProject(supplierId: string, projectId: string): Promise<void> {
  return api.post<void>(API_ENDPOINTS.SUPPLIERS.ASSIGN(supplierId, projectId));
}

export function removeFromProject(supplierId: string, projectId: string): Promise<void> {
  return api.delete<void>(API_ENDPOINTS.SUPPLIERS.REMOVE(supplierId, projectId));
}
