import { useQuery } from '@tanstack/react-query';
import { UserScope } from '@mintit/types';
import { api } from './api';

export interface SessionUser {
  email: string;
  role: UserScope;
}

// The session lives in an httpOnly cookie that JS can't read, so "am I logged
// in?" is answered by asking the API.
export const sessionQueryKey = ['auth', 'me'] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => api.get<SessionUser>('/auth/me').then((r) => r.data),
    retry: false,
    staleTime: 0,
  });
}

/** Only hides UI; the API enforces roles on every request. */
export function useIsAdmin(): boolean {
  return useSession().data?.role === UserScope.ADMIN;
}
