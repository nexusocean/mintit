import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getToken } from '@/src/lib/api';
import { safeNext } from '@/src/utils';

/** Redirects to /login before rendering anything when there's no session. */
export function RequireAuth() {
  const { pathname, search } = useLocation();

  if (!getToken()) {
    const target = pathname + search;
    const query = target === '/' ? '' : `?next=${encodeURIComponent(target)}`;
    return <Navigate to={`/login${query}`} replace />;
  }

  return <Outlet />;
}

/** Sends already-logged-in users away from /login. */
export function RedirectIfAuthed() {
  const { search } = useLocation();

  if (getToken()) {
    const next = new URLSearchParams(search).get('next');
    return <Navigate to={safeNext(next)} replace />;
  }

  return <Outlet />;
}
