import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import * as usersApi from '@/api/endpoints/users';

export function useUsersQuery(params?: { pageSize?: number; role?: string }) {
  return useQuery({
    queryKey: queryKeys.users.list(params as Record<string, unknown> ?? {}),
    queryFn: () => usersApi.getUsers({ pageSize: params?.pageSize ?? 200, role: params?.role }),
    staleTime: 60_000,
    gcTime: 120_000,
  });
}
