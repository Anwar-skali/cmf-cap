import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as risksApi from '@/api/endpoints/risks';
import { useToast } from '@/hooks/useToast';
import type { CreateRiskRequest } from '@/types';

export function useCreateRiskMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: CreateRiskRequest) => risksApi.createRisk(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.risks.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.risks.distribution() });
      toast.success('Risk created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create risk');
    },
  });
}

export function useUpdateRiskMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRiskRequest> & { gate?: string; cate?: string } }) =>
      risksApi.updateRisk(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.risks.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.risks.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.risks.distribution() });
      queryClient.invalidateQueries({ queryKey: queryKeys.capacity.lists() });
      toast.success('Risk updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update risk');
    },
  });
}

export function useDeleteRiskMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => risksApi.deleteRisk(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.risks.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.risks.distribution() });
      queryClient.invalidateQueries({ queryKey: queryKeys.capacity.lists() });
      toast.success('Risk deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete risk');
    },
  });
}

export function useMitigateRiskMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, mitigationPlan }: { id: string; mitigationPlan?: string }) =>
      risksApi.mitigateRisk(id, mitigationPlan),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.risks.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.risks.detail(variables.id) });
      toast.success('Risk mitigation plan submitted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mitigate risk');
    },
  });
}

export function useCloseRiskMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => risksApi.closeRisk(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.risks.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.risks.detail(id) });
      toast.success('Risk closed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to close risk');
    },
  });
}
