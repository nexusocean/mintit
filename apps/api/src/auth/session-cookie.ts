import type { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE = 'admin_session';

// Matches the JWT's expiresIn ('1d') in auth.module.ts.
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function cookieOptions(req: Request): CookieOptions {
  return {
    httpOnly: true,
    // req.secure honors X-Forwarded-Proto because main.ts trusts one proxy hop,
    // so this is true behind a TLS-terminating proxy and false on plain-HTTP dev.
    secure: req.secure,
    sameSite: 'strict',
    // Only API routes need the session; keeps it off /i/* pages and assets.
    path: '/v1',
  };
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(req),
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(req));
}

export function readSessionCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1 || part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}
