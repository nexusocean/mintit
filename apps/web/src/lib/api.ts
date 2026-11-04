import axios from 'axios';
import Cookies from 'js-cookie';

const TOKEN_COOKIE = 'admin_session';

const baseURL = import.meta.env.VITE_API_URL ?? '/v1';

export const api = axios.create({
  baseURL,
});

export function publicInvoiceUrl(publicId: string): string {
  const apiOrigin = new URL(baseURL, window.location.origin).origin;
  return `${apiOrigin}/i/${publicId}`;
}

api.interceptors.request.use((config) => {
  const token = Cookies.get(TOKEN_COOKIE);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      (error.response?.status === 401 || error.response?.status === 403) &&
      window.location.pathname !== '/login'
    ) {
      clearToken();
      const here = window.location.pathname + window.location.search;
      window.location.assign(
        here === '/' ? '/login' : `/login?next=${encodeURIComponent(here)}`,
      );
    }
    return Promise.reject(error);
  },
);

export function setToken(token: string) {
  Cookies.set(TOKEN_COOKIE, token, { sameSite: 'strict', expires: 1 });
}

export function clearToken() {
  Cookies.remove(TOKEN_COOKIE);
}

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_COOKIE);
}

export interface XmrWalletInfo {
  chain: 'xmr';
  primaryAddress: string;
  viewKey: string;
  restoreHeight: number;
  walletHeight: number;
  daemonHeight: number;
  synced: boolean;
}
