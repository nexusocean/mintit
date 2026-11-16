import axios from 'axios';
import { HttpService } from '@nestjs/axios';
import { CmcRateProvider } from '../../src/price/providers/cmc.provider';
import { CoinGeckoRateProvider } from '../../src/price/providers/coingecko.provider';
import { KrakenRateProvider } from '../../src/price/providers/kraken.provider';

// Calls the real price APIs directly (not through the app) to catch upstream
// response-shape changes. The CMC suite is skipped without CMC_API_KEY.
const http = new HttpService(axios.create({ timeout: 10_000 }));
const CMC_API_KEY = process.env.CMC_API_KEY;

function expectPlausibleXmrUsd(rate: number) {
  expect(typeof rate).toBe('number');
  // Wide on purpose: this checks the response shape, not the market.
  expect(rate).toBeGreaterThan(1);
  expect(rate).toBeLessThan(100_000);
}

describe('Kraken rate provider (live)', () => {
  const provider = new KrakenRateProvider(http);

  it('returns an XMR/USD rate', async () => {
    expectPlausibleXmrUsd(await provider.getRate('XMR', 'USD'));
  });

  it('rejects an unknown pair', async () => {
    await expect(provider.getRate('NOTACOIN', 'USD')).rejects.toThrow(
      'Kraken error',
    );
  });
});

describe('CoinGecko rate provider (live)', () => {
  const provider = new CoinGeckoRateProvider(http);

  it('returns an XMR/USD rate', async () => {
    expectPlausibleXmrUsd(await provider.getRate('XMR', 'USD'));
  });

  it('rejects an asset it has no mapping for', async () => {
    await expect(provider.getRate('DOGE', 'USD')).rejects.toThrow(
      'No CoinGecko ID',
    );
  });
});

(CMC_API_KEY ? describe : describe.skip)(
  'CoinMarketCap rate provider (live)',
  () => {
    const config = { get: () => CMC_API_KEY };
    const provider = new CmcRateProvider(http, config as never);

    it('returns an XMR/USD rate', async () => {
      expectPlausibleXmrUsd(await provider.getRate('XMR', 'USD'));
    });

    it('fails clearly with a bad key', async () => {
      const bad = new CmcRateProvider(http, {
        get: () => 'invalid-key',
      } as never);
      await expect(bad.getRate('XMR', 'USD')).rejects.toThrow();
    });
  },
);
