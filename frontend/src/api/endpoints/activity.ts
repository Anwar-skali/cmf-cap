import { api } from '@/api/client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { ActivityLog, PaginatedResponse } from '@/types';

export function getActivities(page = 1, pageSize = 20): Promise<PaginatedResponse<ActivityLog>> {
  return api.get<PaginatedResponse<ActivityLog>>(API_ENDPOINTS.ACTIVITY.BASE, {
    params: { page, pageSize },
  });
}

export function getRecentActivities(limit = 10): Promise<ActivityLog[]> {
  return api.get<ActivityLog[]>(API_ENDPOINTS.ACTIVITY.RECENT, {
    params: { limit },
  });
}
