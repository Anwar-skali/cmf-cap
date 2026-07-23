import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as documentsApi from '@/api/endpoints/documents';
import { useToast } from '@/hooks/useToast';

export function useUploadDocumentMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: { file: File; name: string; type: string; description?: string }) =>
      documentsApi.uploadDocument(data.file, { name: data.name, type: data.type, description: data.description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() });
      toast.success('Document uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload document');
    },
  });
}

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
