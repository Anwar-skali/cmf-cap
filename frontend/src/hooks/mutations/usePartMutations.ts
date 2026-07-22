import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as partsApi from '@/api/endpoints/parts';
import { useToast } from '@/hooks/useToast';
import type { CreateProjectPartRequest } from '@/types';

export function useCreatePartMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: CreateProjectPartRequest) => partsApi.createPart(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.lists() });
      toast.success('Part created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create part');
    },
  });
}

export function useUpdatePartMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProjectPartRequest> }) =>
      partsApi.updatePart(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.detail(variables.id) });
      toast.success('Part updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update part');
    },
  });
}

export function useDeletePartMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => partsApi.deletePart(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parts.lists() });
      toast.success('Part deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete part');
    },
  });
}
