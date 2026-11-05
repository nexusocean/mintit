import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// The session lives in an httpOnly cookie that JS can't read, so "am I logged
// in?" is answered by asking the API.
export const sessionQueryKey = ['auth', 'me'] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => api.get<{ email: string }>('/auth/me').then((r) => r.data),
    retry: false,
    staleTime: 0,
  });
}
