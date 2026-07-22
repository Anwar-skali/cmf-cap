import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as suppliersApi from '@/api/endpoints/suppliers';
import { useToast } from '@/hooks/useToast';
import type { CreateSupplierRequest } from '@/types';

export function useCreateSupplierMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: CreateSupplierRequest) => suppliersApi.createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() });
      toast.success('Supplier created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create supplier');
    },
  });
}

export function useUpdateSupplierMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSupplierRequest> }) =>
      suppliersApi.updateSupplier(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.detail(variables.id) });
      toast.success('Supplier updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update supplier');
    },
  });
}

export function useDeleteSupplierMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => suppliersApi.deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() });
      toast.success('Supplier deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete supplier');
    },
  });
}

export function useAssignSupplierToProjectMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ supplierId, projectId }: { supplierId: string; projectId: string }) =>
      suppliersApi.assignToProject(supplierId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
      toast.success('Supplier assigned to project');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign supplier');
    },
  });
}

export function useRemoveSupplierFromProjectMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ supplierId, projectId }: { supplierId: string; projectId: string }) =>
      suppliersApi.removeFromProject(supplierId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
      toast.success('Supplier removed from project');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove supplier');
    },
  });
}
