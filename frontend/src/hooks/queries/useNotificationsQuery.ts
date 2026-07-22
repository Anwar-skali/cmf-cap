import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as notificationsApi from '@/api/endpoints/notifications';

export function useNotificationsQuery(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: queryKeys.notifications.list({ page, pageSize }),
    queryFn: () => notificationsApi.getNotifications(page, pageSize),
    staleTime: 15_000,
    gcTime: 30_000,
  });
}

export function useUnreadCountQuery() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => notificationsApi.getUnreadCount(),
    staleTime: 10_000,
    gcTime: 30_000,
    refetchInterval: 30_000,
  });
}
