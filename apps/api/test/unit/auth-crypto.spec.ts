import { randomBytes } from 'crypto';
import { safeEqual } from '../../src/auth/safe-equal';
import {
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  hashBackupCode,
  isEncryptedSecret,
  isHashedBackupCode,
} from '../../src/auth/totp-crypto';

const KEY = randomBytes(32);

describe('safeEqual', () => {
  it('matches equal strings', () => expect(safeEqual('abc', 'abc')).toBe(true));
  it('rejects different strings', () =>
    expect(safeEqual('abc', 'abd')).toBe(false));
  it('rejects different lengths', () =>
    expect(safeEqual('abc', 'abcd')).toBe(false));
  it('rejects empty against non-empty', () =>
    expect(safeEqual('', 'a')).toBe(false));
});

describe('TOTP secret encryption', () => {
  it('round-trips a secret', () => {
    const stored = encryptSecret(KEY, 'JBSWY3DPEHPK3PXP');
    expect(isEncryptedSecret(stored)).toBe(true);
    expect(stored).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(KEY, stored)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('uses a fresh IV each time', () => {
    expect(encryptSecret(KEY, 's')).not.toBe(encryptSecret(KEY, 's'));
  });

  it('fails to decrypt with the wrong key', () => {
    const stored = encryptSecret(KEY, 'secret');
    expect(() => decryptSecret(randomBytes(32), stored)).toThrow();
  });

  it('fails to decrypt a tampered ciphertext', () => {
    const stored = encryptSecret(KEY, 'secret');
    const raw = Buffer.from(stored.slice(3), 'base64');
    raw[raw.length - 1] ^= 1;
    expect(() => decryptSecret(KEY, 'v1:' + raw.toString('base64'))).toThrow();
  });

  it('does not treat a plaintext secret as encrypted', () => {
    expect(isEncryptedSecret('JBSWY3DPEHPK3PXP')).toBe(false);
  });
});

describe('backup codes', () => {
  it('generates 10 codes of 10 unambiguous characters', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    for (const c of codes) expect(c).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
    expect(new Set(codes).size).toBe(10);
  });

  it('hashes with a prefix and never stores the code', () => {
    const h = hashBackupCode(KEY, 'ABCDE23456');
    expect(isHashedBackupCode(h)).toBe(true);
    expect(h).not.toContain('ABCDE23456');
  });

  it('ignores case, spaces and dashes when hashing', () => {
    const h = hashBackupCode(KEY, 'ABCDE23456');
    expect(hashBackupCode(KEY, ' abcde-23456 ')).toBe(h);
    expect(hashBackupCode(KEY, 'abcde 23456')).toBe(h);
  });

  it('depends on the key', () => {
    expect(hashBackupCode(randomBytes(32), 'ABCDE23456')).not.toBe(
      hashBackupCode(KEY, 'ABCDE23456'),
    );
  });
});
