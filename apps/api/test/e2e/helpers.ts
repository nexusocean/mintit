import axios, { AxiosResponse } from 'axios';

export const ORIGIN = (
  process.env.E2E_BASE_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');
export const API_BASE = `${ORIGIN}/v1`;
export const SESSION_COOKIE = 'admin_session';

// Assert on status codes ourselves instead of having axios throw on 4xx.
export const api = axios.create({
  baseURL: API_BASE,
  validateStatus: () => true,
});
/** Unprefixed routes: the hosted checkout page and its status poll. */
export const site = axios.create({
  baseURL: ORIGIN,
  validateStatus: () => true,
});

export const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const UNKNOWN_UUID = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name} in .env.test (see .env.example.test)`);
  return v;
}

export const apiKey = (): string => required('E2E_API_KEY');

export function adminCreds(): {
  email: string;
  password: string;
  token?: string;
} {
  return {
    email: required('E2E_ADMIN_EMAIL'),
    password: required('E2E_ADMIN_PASSWORD'),
    token: process.env.E2E_ADMIN_TOTP || undefined,
  };
}

export function sessionSetCookie(res: AxiosResponse): string | undefined {
  return res.headers['set-cookie']?.find((c) =>
    c.startsWith(`${SESSION_COOKIE}=`),
  );
}

/** Logs in and returns a Cookie header value. */
export async function login(): Promise<string> {
  const res = await api.post('/auth/login', adminCreds());
  if (res.status !== 204) {
    throw new Error(
      `Login failed with ${res.status}: ${JSON.stringify(res.data)}`,
    );
  }
  const header = sessionSetCookie(res);
  if (!header) throw new Error('Login did not set the session cookie');
  return header.split(';')[0];
}

/** Creates a small, short-lived invoice through the merchant API. */
export async function createInvoice(body: Record<string, unknown> = {}) {
  const res = await api.post(
    '/invoices',
    {
      chain: 'xmr',
      amountAtomic: '1000000000', // 0.001 XMR
      expiresInSeconds: 600,
      memo: 'e2e test invoice',
      metadata: { source: 'e2e' },
      ...body,
    },
    { headers: { 'X-Api-Key': apiKey() } },
  );
  if (res.status !== 201) {
    throw new Error(
      `Invoice create failed with ${res.status}: ${JSON.stringify(res.data)}`,
    );
  }
  return res.data as Record<string, any>;
}
