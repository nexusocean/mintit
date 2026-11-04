// Seed values for the Postgres-backed Settings row, and the scanner poll interval.
// Runtime-tunable values live in Postgres after first seed; these are just starting points.
export const TUNABLE_DEFAULTS = {
  CONFIRMATION_DEPTH: 1,
  INVOICE_DEFAULT_EXPIRY_SEC: 7200,
  SCANNER_INTERVAL_MS: 10_000,
  SCANNER_LOCK_TTL_MS: 30_000,
  MONERO_SYNCED_THRESHOLD_BLOCKS: 2,
  RATE_CACHE_TTL_MS: 45_000,
  WEBHOOK_MAX_ATTEMPTS: 8,
  WEBHOOK_DISPATCH_INTERVAL_MS: 5_000,
  WEBHOOK_TIMEOUT_MS: 10_000,
} as const;
