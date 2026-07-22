import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as activityApi from '@/api/endpoints/activity';

export function useActivitiesQuery(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: queryKeys.activity.list({ page, pageSize }),
    queryFn: () => activityApi.getActivities(page, pageSize),
    staleTime: 30_000,
    gcTime: 60_000,
  });
}

export function useRecentActivitiesQuery(limit = 10) {
  return useQuery({
    queryKey: queryKeys.activity.recent(),
    queryFn: () => activityApi.getRecentActivities(limit),
    staleTime: 30_000,
    gcTime: 60_000,
  });
}
