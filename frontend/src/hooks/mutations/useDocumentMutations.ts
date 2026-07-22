import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as documentsApi from '@/api/endpoints/documents';
import { useToast } from '@/hooks/useToast';

export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => documentsApi.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() });
      toast.success('Document deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete document');
    },
  });
}
