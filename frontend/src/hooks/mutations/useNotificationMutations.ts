import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as notificationsApi from '@/api/endpoints/notifications';
import { useToast } from '@/hooks/useToast';

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark notification as read');
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      toast.success('All notifications marked as read');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark all as read');
    },
  });
}

export function useDeleteNotificationMutation() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      toast.success('Notification deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete notification');
    },
  });
}
