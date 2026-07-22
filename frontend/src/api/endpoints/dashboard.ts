import { api } from '@/api/client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { DashboardStats } from '@/types';

export function getDashboardStats(): Promise<DashboardStats> {
  return api.get<DashboardStats>(API_ENDPOINTS.DASHBOARD.STATS);
}
