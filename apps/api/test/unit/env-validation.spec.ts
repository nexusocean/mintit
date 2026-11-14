import { Chain } from '@mintit/types';
import { NodeEnv, validateEnv } from '../../src/config/env.validation';

const VALID = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  API_KEY: 'a'.repeat(16),
  WEBHOOK_SIGNING_SECRET: 'secret',
  ENABLED_CHAINS: 'xmr',
  MONERO_DAEMON_URI: 'http://localhost:18081',
  MONERO_DAEMON_USER: 'user',
  MONERO_DAEMON_PASSWORD: 'pass',
  MONERO_WALLET_PATH: './data/wallet/merchant',
};

const env = (over: Record<string, unknown> = {}) =>
  validateEnv({ ...VALID, ...over });

describe('validateEnv', () => {
  it('accepts a complete config and applies defaults', () => {
    const v = env();
    expect(v.PORT).toBe(3000);
    expect(v.AUTH_DISABLE_TOTP).toBe(false);
    expect(v.ENABLED_CHAINS).toEqual([Chain.Xmr]);
  });

  it('parses ints, booleans and chain lists from strings', () => {
    const v = env({
      PORT: '8080',
      MONERO_RESTORE_HEIGHT: '2142513',
      AUTH_DISABLE_TOTP: 'TRUE',
      ENABLED_CHAINS: ' XMR ',
    });
    expect(v.PORT).toBe(8080);
    expect(v.MONERO_RESTORE_HEIGHT).toBe(2142513);
    expect(v.AUTH_DISABLE_TOTP).toBe(true);
    expect(v.ENABLED_CHAINS).toEqual([Chain.Xmr]);
  });

  it('refuses AUTH_DISABLE_TOTP in production', () => {
    expect(() =>
      env({ NODE_ENV: NodeEnv.Production, AUTH_DISABLE_TOTP: 'true' }),
    ).toThrow('AUTH_DISABLE_TOTP cannot be enabled in production');
  });

  it.each(['DATABASE_URL', 'API_KEY', 'WEBHOOK_SIGNING_SECRET'])(
    'requires %s',
    (key) => {
      expect(() => env({ [key]: undefined })).toThrow('Invalid environment');
    },
  );

  it('requires an API key of at least 16 characters', () => {
    expect(() => env({ API_KEY: 'short' })).toThrow('Invalid environment');
  });

  it('rejects an unknown chain', () => {
    expect(() => env({ ENABLED_CHAINS: 'xmr,doge' })).toThrow(
      'Invalid environment',
    );
  });

  it('rejects a malformed view key', () => {
    expect(() => env({ MONERO_VIEW_KEY: 'abc' })).toThrow(
      'Invalid environment',
    );
    expect(() => env({ MONERO_VIEW_KEY: 'z'.repeat(64) })).toThrow(
      'Invalid environment',
    );
    expect(() => env({ MONERO_VIEW_KEY: 'a'.repeat(64) })).not.toThrow();
  });

  it('names the missing Monero vars when XMR is enabled', () => {
    expect(() =>
      env({ MONERO_DAEMON_USER: undefined, MONERO_WALLET_PATH: undefined }),
    ).toThrow(
      'XMR enabled but missing required vars: MONERO_DAEMON_USER, MONERO_WALLET_PATH',
    );
  });
});
