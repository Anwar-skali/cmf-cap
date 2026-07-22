import { api } from '@/api/client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { Notification, PaginatedResponse } from '@/types';

export function getNotifications(page = 1, pageSize = 20): Promise<PaginatedResponse<Notification>> {
  return api.get<PaginatedResponse<Notification>>(API_ENDPOINTS.NOTIFICATIONS.BASE, {
    params: { page, pageSize },
  });
}

export function getUnreadCount(): Promise<{ count: number }> {
  return api.get<{ count: number }>(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT);
}

export function markAsRead(id: string): Promise<void> {
  return api.post<void>(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
}

export function markAllAsRead(): Promise<void> {
  return api.post<void>(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
}

export function deleteNotification(id: string): Promise<void> {
  return api.delete<void>(API_ENDPOINTS.NOTIFICATIONS.BY_ID(id));
}
