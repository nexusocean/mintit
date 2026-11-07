import axios, { AxiosResponse } from 'axios';

const BASE = 'http://localhost:3000/v1';

// Runs against a live instance with an already-active admin, so nothing here
// registers, sets up TOTP, or changes credentials.
const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;
// DEMO_ADMIN_TOTP on the instance, or a backup code. A real authenticator code
// can't be reused, so it only works for a single run.
const TOTP = process.env.E2E_ADMIN_TOTP;

const SESSION_COOKIE = 'admin_session';

// Assert on status codes ourselves instead of having axios throw on 4xx.
const api = axios.create({ baseURL: BASE, validateStatus: () => true });

function requireCreds(): { email: string; password: string } {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (and E2E_ADMIN_TOTP when TOTP is required)',
    );
  }
  return { email: EMAIL, password: PASSWORD };
}

function sessionSetCookie(res: AxiosResponse): string | undefined {
  return res.headers['set-cookie']?.find((c) =>
    c.startsWith(`${SESSION_COOKIE}=`),
  );
}

describe('Auth', () => {
  let totpRequired: boolean;
  let profileLocked: boolean;

  beforeAll(async () => {
    const { data } = await api.get('/auth/status');
    totpRequired = data.totpRequired;
    profileLocked = data.profileLocked;
  });

  describe('GET /auth/status', () => {
    it('reports a registered admin', async () => {
      const { status, data } = await api.get('/auth/status');
      expect(status).toBe(200);
      expect(data.registered).toBe(true);
      expect(typeof data.totpRequired).toBe('boolean');
    });
  });

  describe('unauthenticated access', () => {
    it('rejects /auth/me without a session cookie', async () => {
      const { status } = await api.get('/auth/me');
      expect(status).toBe(401);
    });

    it('rejects /auth/me with a forged session cookie', async () => {
      const { status } = await api.get('/auth/me', {
        headers: { Cookie: `${SESSION_COOKIE}=not.a.jwt` },
      });
      expect(status).toBe(401);
    });

    it('rejects PATCH /auth/update without a session cookie', async () => {
      const { status } = await api.patch('/auth/update', {
        email: 'admin@example.com',
        password: 'whatever',
      });
      expect(status).toBe(401);
    });
  });

  describe('POST /auth/login', () => {
    it('rejects an invalid body', async () => {
      const { status } = await api.post('/auth/login', { password: 'x' });
      expect(status).toBe(400);
    });

    it('rejects a wrong password', async () => {
      const { email } = requireCreds();
      const res = await api.post('/auth/login', {
        email,
        password: 'definitely-wrong-password',
        token: TOTP,
      });
      expect(res.status).toBe(401);
      expect(sessionSetCookie(res)).toBeUndefined();
    });

    it('rejects a missing TOTP code when TOTP is required', async () => {
      if (!totpRequired) return;
      const res = await api.post('/auth/login', requireCreds());
      expect(res.status).toBe(401);
      expect(sessionSetCookie(res)).toBeUndefined();
    });
  });

  describe('first-time setup endpoints on an active account', () => {
    it('refuses to register a second admin', async () => {
      const { status } = await api.post('/auth/register', {
        email: 'second-admin@example.com',
        password: 'another-password',
      });
      expect(status).toBe(403);
    });

    it('refuses to re-run TOTP setup', async () => {
      const { status } = await api.post('/auth/setup', requireCreds());
      expect(status).toBe(403);
    });

    it('refuses TOTP setup with a wrong password', async () => {
      const { email } = requireCreds();
      const { status } = await api.post('/auth/setup', {
        email,
        password: 'definitely-wrong-password',
      });
      expect(status).toBe(401);
    });

    it('refuses to re-verify TOTP', async () => {
      const { status } = await api.post('/auth/verify', {
        ...requireCreds(),
        token: '000000',
      });
      expect(status).toBe(403);
    });
  });

  describe('session', () => {
    let setCookie: string;
    let cookie: string;

    beforeAll(async () => {
      const res = await api.post('/auth/login', {
        ...requireCreds(),
        token: TOTP,
      });
      if (res.status !== 204) {
        throw new Error(
          `Login failed with ${res.status}: ${JSON.stringify(res.data)}`,
        );
      }
      const header = sessionSetCookie(res);
      if (!header) throw new Error('Login did not set the session cookie');
      setCookie = header;
      cookie = header.split(';')[0];
    });

    it('sets a locked-down session cookie', () => {
      expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=.+`));
      expect(setCookie).toMatch(/;\s*HttpOnly/i);
      expect(setCookie).toMatch(/;\s*SameSite=Strict/i);
      expect(setCookie).toMatch(/;\s*Path=\/v1(;|$)/i);
      expect(setCookie).toMatch(/;\s*Max-Age=86400/i);
    });

    it('returns the current admin from /auth/me', async () => {
      const { status, data } = await api.get('/auth/me', {
        headers: { Cookie: cookie },
      });
      expect(status).toBe(200);
      expect(data.email).toBe(EMAIL!.toLowerCase());
    });

    it('never exposes secrets from /auth/me', async () => {
      const { data } = await api.get('/auth/me', {
        headers: { Cookie: cookie },
      });
      expect(data).not.toHaveProperty('password');
      expect(data).not.toHaveProperty('totpSecret');
      expect(data).not.toHaveProperty('backupCodes');
      expect(data).not.toHaveProperty('lastUsedTotp');
    });

    it('rejects PATCH /auth/update with a wrong current password', async () => {
      const { status } = await api.patch(
        '/auth/update',
        { email: EMAIL, password: 'definitely-wrong-password' },
        { headers: { Cookie: cookie } },
      );
      // Demo mode refuses every update before checking the password.
      expect(status).toBe(profileLocked ? 403 : 401);
    });

    it('clears the session cookie on logout', async () => {
      const res = await api.post('/auth/logout', undefined, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(204);
      const cleared = sessionSetCookie(res);
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);
    });
  });
});
