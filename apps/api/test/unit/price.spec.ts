import { ServiceUnavailableException } from '@nestjs/common';
import { PriceService } from '../../src/price/price.service';
import type { RateProvider } from '../../src/price/rate-provider.interface';

const TTL = 45_000;

function provider(source: string, rate?: number): jest.Mocked<RateProvider> {
  return {
    source,
    getRate: jest.fn<Promise<number>, [string, string]>(async () => {
      if (rate === undefined) throw new Error(`${source} down`);
      return rate;
    }),
  };
}

function setup(...providers: RateProvider[]) {
  const settings = { getGlobal: () => ({ rateCacheTtlMs: TTL }) };
  return new PriceService(providers, settings as never);
}

describe('PriceService', () => {
  beforeEach(() =>
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') }),
  );
  afterEach(() => jest.useRealTimers());

  describe('getQuote', () => {
    it('returns the first provider’s rate and its inverse', async () => {
      const svc = setup(provider('cmc', 200), provider('coingecko', 999));
      const q = await svc.getQuote('xmr', 'usd');
      expect(q).toMatchObject({
        fiatPerAsset: 200,
        assetPerFiat: 0.005,
        fiatCurrency: 'USD',
        source: 'cmc',
      });
    });

    it('falls back to the next provider when one fails', async () => {
      const svc = setup(provider('cmc'), provider('coingecko', 180));
      const q = await svc.getQuote('XMR', 'USD');
      expect(q.source).toBe('coingecko');
      expect(q.fiatPerAsset).toBe(180);
    });

    it('serves a cached quote within the TTL', async () => {
      const cmc = provider('cmc', 200);
      const svc = setup(cmc);
      await svc.getQuote('XMR', 'USD');
      jest.advanceTimersByTime(TTL - 1);
      await svc.getQuote('xmr', 'usd');
      expect(cmc.getRate).toHaveBeenCalledTimes(1);
    });

    it('refetches once the TTL has passed', async () => {
      const cmc = provider('cmc', 200);
      const svc = setup(cmc);
      await svc.getQuote('XMR', 'USD');
      jest.advanceTimersByTime(TTL);
      await svc.getQuote('XMR', 'USD');
      expect(cmc.getRate).toHaveBeenCalledTimes(2);
    });

    it('serves a stale quote when every provider fails', async () => {
      const cmc = provider('cmc', 200);
      const svc = setup(cmc);
      const first = await svc.getQuote('XMR', 'USD');
      jest.advanceTimersByTime(TTL * 10);
      cmc.getRate.mockRejectedValue(new Error('down'));
      await expect(svc.getQuote('XMR', 'USD')).resolves.toBe(first);
    });

    it('throws 503 when every provider fails and nothing is cached', async () => {
      const svc = setup(provider('cmc'), provider('coingecko'));
      await expect(svc.getQuote('XMR', 'USD')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  describe('convertFiatToAtomic', () => {
    const svc = setup();
    const quote = (assetPerFiat: number) => ({
      assetPerFiat,
      fiatPerAsset: 1 / assetPerFiat,
      fiatCurrency: 'USD',
      fetchedAt: new Date(),
      source: 'test',
    });

    it('converts fiat to atomic units', () => {
      // $19.99 at $200/XMR = 0.09995 XMR
      expect(svc.convertFiatToAtomic(19.99, quote(0.005), 12)).toBe(
        '99950000000',
      );
    });

    it('rounds up so the invoice never asks for less than the fiat amount', () => {
      expect(svc.convertFiatToAtomic(1, quote(1.3e-12), 12)).toBe('2');
    });

    it('accepts a numeric string', () => {
      expect(svc.convertFiatToAtomic('10', quote(0.005), 12)).toBe(
        '50000000000',
      );
    });

    it.each([0, -1])('rejects %p', (amount) => {
      expect(() => svc.convertFiatToAtomic(amount, quote(0.005), 12)).toThrow(
        'amountFiat must be > 0',
      );
    });

    it('rejects a non-numeric amount', () => {
      expect(() => svc.convertFiatToAtomic('abc', quote(0.005), 12)).toThrow();
    });
  });
});
