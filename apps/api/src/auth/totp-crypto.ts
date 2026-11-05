import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
} from 'crypto';

const SECRET_PREFIX = 'v1:';
const CODE_PREFIX = 'hmac:';
// No 0/O or 1/I/L, so codes survive being read off paper.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;

/** AES-256-GCM; stored as "v1:" + base64(iv | tag | ciphertext). */
export function encryptSecret(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return SECRET_PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptSecret(key: Buffer, stored: string): string {
  const raw = Buffer.from(stored.slice(SECRET_PREFIX.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([
    decipher.update(raw.subarray(28)),
    decipher.final(),
  ]).toString('utf8');
}

export const isEncryptedSecret = (stored: string): boolean =>
  stored.startsWith(SECRET_PREFIX);

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    Array.from(
      { length: CODE_LENGTH },
      () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
    ).join(''),
  );
}

/** Keyed hash, so short codes can't be brute-forced from a database leak. */
export function hashBackupCode(key: Buffer, code: string): string {
  const normalized = code.trim().toUpperCase().replace(/[\s-]/g, '');
  return (
    CODE_PREFIX + createHmac('sha256', key).update(normalized).digest('hex')
  );
}

export const isHashedBackupCode = (stored: string): boolean =>
  stored.startsWith(CODE_PREFIX);
