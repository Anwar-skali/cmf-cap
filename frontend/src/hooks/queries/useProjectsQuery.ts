import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as projectsApi from '@/api/endpoints/projects';
import type { ProjectFilter } from '@/types';

export function useProjectsQuery(filter?: ProjectFilter) {
  return useQuery({
    queryKey: queryKeys.projects.list(filter as Record<string, unknown>),
    queryFn: () => projectsApi.getProjects(filter),
    staleTime: 0,        // always refetch when navigating back to the list
    gcTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useProjectQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: () => projectsApi.getProject(id),
    enabled: !!id,
    staleTime: 30_000,
    gcTime: 60_000,
  });
}
