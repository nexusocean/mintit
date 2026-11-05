import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

// Kept next to the JWT secret (same volume, never in the database), so a
// database leak alone exposes neither TOTP secrets nor usable backup codes.
// Generated per instance for the same reason as the JWT secret.
// Losing this file makes stored TOTP secrets unreadable: back it up with data/.
const KEY_PATH = join(
  dirname(process.env.JWT_SECRET_PATH ?? '/app/data/jwt/secret'),
  'totp-key',
);

export const getOrCreateTotpKey = (): Buffer => {
  if (existsSync(KEY_PATH)) {
    const key = Buffer.from(readFileSync(KEY_PATH, 'utf8').trim(), 'hex');
    if (key.length !== 32) throw new Error(`Invalid TOTP key at ${KEY_PATH}`);
    return key;
  }

  const key = randomBytes(32);
  mkdirSync(dirname(KEY_PATH), { recursive: true });
  writeFileSync(KEY_PATH, key.toString('hex'), { mode: 0o600 });
  return key;
};
