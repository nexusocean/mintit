import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/src/lib/session';
import { PageLoader } from '@/src/components/PageLoader';
import { safeNext } from '@/src/utils';

/** Redirects to /login before rendering anything when there's no session. */
export function RequireAuth() {
  const { pathname, search } = useLocation();
  const session = useSession();

  if (session.isPending) return <PageLoader />;

  if (session.isError) {
    const target = pathname + search;
    const query = target === '/' ? '' : `?next=${encodeURIComponent(target)}`;
    return <Navigate to={`/login${query}`} replace />;
  }

  return <Outlet />;
}

/** Sends already-logged-in users away from /login. */
export function RedirectIfAuthed() {
  const { search } = useLocation();
  const session = useSession();

  if (session.isPending) return <PageLoader />;

  if (session.isSuccess) {
    const next = new URLSearchParams(search).get('next');
    return <Navigate to={safeNext(next)} replace />;
  }

  return <Outlet />;
}
