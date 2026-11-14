import { randomBytes } from 'crypto';
import { IsNull } from 'typeorm';
import { TOTP } from '@otplib/totp';
import { NodeCryptoPlugin } from '@otplib/plugin-crypto-node';
import { ScureBase32Plugin } from '@otplib/plugin-base32-scure';
import { TotpService } from '../../src/auth/totp.service';
import { encryptSecret, hashBackupCode } from '../../src/auth/totp-crypto';

const KEY = randomBytes(32);

// The real key lives on disk next to the JWT secret; never touch that here.
jest.mock('../../src/config/totp-key', () => ({
  getOrCreateTotpKey: () => KEY,
}));

const otp = new TOTP({
  crypto: new NodeCryptoPlugin(),
  base32: new ScureBase32Plugin(),
});
const SECRET = otp.generateSecret();

function setup(
  opts: { demoTotp?: string; user?: Record<string, unknown> | null } = {},
) {
  const user =
    opts.user === undefined
      ? {
          id: 'user-1',
          totpSecret: encryptSecret(KEY, SECRET),
          lastUsedTotp: null,
        }
      : opts.user;
  const qb = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => user),
  };
  const userRepo = {
    createQueryBuilder: jest.fn(() => qb),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const backupCodeRepo = { update: jest.fn(async () => ({ affected: 1 })) };
  const config = {
    get: jest.fn((k: string) =>
      k === 'DEMO_ADMIN_TOTP' ? opts.demoTotp : false,
    ),
  };
  const service = new TotpService(
    userRepo as never,
    backupCodeRepo as never,
    config as never,
  );
  return { service, userRepo, backupCodeRepo };
}

describe('TotpService.validateTotp', () => {
  it('accepts a current authenticator code and records it', async () => {
    const t = setup();
    const code = await otp.generate({ secret: SECRET });

    expect(await t.service.validateTotp('user-1', code)).toBe(true);
    expect(t.userRepo.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      { lastUsedTotp: code },
    );
  });

  it('rejects a replay of the last used code', async () => {
    const code = await otp.generate({ secret: SECRET });
    const t = setup({
      user: {
        id: 'user-1',
        totpSecret: encryptSecret(KEY, SECRET),
        lastUsedTotp: code,
      },
    });
    expect(await t.service.validateTotp('user-1', code)).toBe(false);
  });

  it('rejects a wrong 6-digit code without trying backup codes', async () => {
    const t = setup();
    const code = await otp.generate({ secret: SECRET });
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');

    expect(await t.service.validateTotp('user-1', wrong)).toBe(false);
    expect(t.backupCodeRepo.update).not.toHaveBeenCalled();
  });

  it('spends a backup code with a single conditional update', async () => {
    const t = setup();

    expect(await t.service.validateTotp('user-1', 'abcde-23456')).toBe(true);
    expect(t.backupCodeRepo.update).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        codeHash: hashBackupCode(KEY, 'ABCDE23456'),
        pending: false,
        usedAt: IsNull(),
      },
      { usedAt: expect.any(Date) },
    );
  });

  it('rejects a backup code that is unknown or already used', async () => {
    const t = setup();
    t.backupCodeRepo.update.mockResolvedValueOnce({ affected: 0 });
    expect(await t.service.validateTotp('user-1', 'ABCDE23456')).toBe(false);
  });

  it('accepts the demo code when one is configured', async () => {
    const t = setup({ demoTotp: '123456' });
    expect(await t.service.validateTotp('user-1', '123456')).toBe(true);
  });

  it('rejects everything when the user has no secret', async () => {
    const t = setup({ user: { id: 'user-1', totpSecret: null } });
    expect(await t.service.validateTotp('user-1', '123456')).toBe(false);
  });
});
