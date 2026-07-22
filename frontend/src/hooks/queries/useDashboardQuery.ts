import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as dashboardApi from '@/api/endpoints/dashboard';

export function useDashboardStatsQuery() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => dashboardApi.getDashboardStats(),
    staleTime: 60_000,
    gcTime: 120_000,
  });
}
