import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? '/v1';

export const api = axios.create({
  baseURL,
  // Sends the httpOnly session cookie when the API is on another origin (dev).
  withCredentials: true,
});

export function publicInvoiceUrl(publicId: string): string {
  const apiOrigin = new URL(baseURL, window.location.origin).origin;
  return `${apiOrigin}/i/${publicId}`;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      // The auth guards handle a failed session check themselves.
      error.config?.url !== '/auth/me' &&
      window.location.pathname !== '/login'
    ) {
      const here = window.location.pathname + window.location.search;
      window.location.assign(
        here === '/' ? '/login' : `/login?next=${encodeURIComponent(here)}`,
      );
    }
    return Promise.reject(error);
  },
);

export interface XmrWalletInfo {
  chain: 'xmr';
  primaryAddress: string;
  viewKey: string;
  restoreHeight: number;
  walletHeight: number;
  daemonHeight: number;
  synced: boolean;
}
