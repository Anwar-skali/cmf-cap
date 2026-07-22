import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as documentsApi from '@/api/endpoints/documents';

interface DocumentFilter {
  projectId?: string;
  partId?: string;
  supplierId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

export function useDocumentsQuery(filter?: DocumentFilter) {
  return useQuery({
    queryKey: queryKeys.documents.list(filter as Record<string, unknown>),
    queryFn: () => documentsApi.getDocuments(filter),
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

export function useDocumentQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.documents.detail(id),
    queryFn: () => documentsApi.getDocument(id),
    enabled: !!id,
    staleTime: 30_000,
    gcTime: 60_000,
  });
}
