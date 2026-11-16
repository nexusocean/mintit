import { isAxiosError } from 'axios';

/** The API's error message (Nest's `message`), or a fallback. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    if (err.response?.status === 429) {
      return 'Too many attempts, try again in a minute';
    }
    const message: unknown = err.response?.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && typeof message[0] === 'string') {
      return message[0];
    }
  }
  return fallback;
}
