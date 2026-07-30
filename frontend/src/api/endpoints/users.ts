import { api } from '@/api/client';

export interface UserListItem {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

export interface UserListResponse {
  items: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function getUsers(params?: { page?: number; pageSize?: number; role?: string }): Promise<UserListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('page_size', String(params.pageSize));
  if (params?.role) query.set('role', params.role);
  return api.get<UserListResponse>(`/users?${query.toString()}`);
}
