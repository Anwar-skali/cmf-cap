import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as capacityApi from '@/api/endpoints/capacity';
import { useToast } from '@/hooks/useToast';
import type { CreateCapacityAssessmentRequest } from '@/types';

export function useCreateCapacityMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: CreateCapacityAssessmentRequest) => capacityApi.createAssessment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capacity.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.capacity.coverage() });
      queryClient.invalidateQueries({ queryKey: queryKeys.capacity.monthly() });
      toast.success('Capacity assessment created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create assessment');
    },
  });
}

export function useUpdateCapacityMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCapacityAssessmentRequest> }) =>
      capacityApi.updateAssessment(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capacity.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.capacity.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.capacity.coverage() });
      queryClient.invalidateQueries({ queryKey: queryKeys.capacity.monthly() });
      toast.success('Capacity assessment updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update assessment');
    },
  });
}

export function useDeleteCapacityMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => capacityApi.deleteAssessment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.capacity.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.capacity.coverage() });
      queryClient.invalidateQueries({ queryKey: queryKeys.capacity.monthly() });
      toast.success('Capacity assessment deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete assessment');
    },
  });
}
