export function formatAtomic(
  atomic: string,
  decimals: number,
  ticker: string,
): string {
  const divisor = Math.pow(10, decimals);
  const val = (Number(atomic) / divisor)
    .toFixed(decimals)
    .replace(/\.?0+$/, '');
  return `${val} ${ticker.toUpperCase()}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Only allow same-app paths as a post-login destination, so `?next=` can't
 * be used to bounce the user to another site (e.g. `//evil.com`).
 */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
