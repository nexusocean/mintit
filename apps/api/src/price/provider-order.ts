import type { RateProvider } from './rate-provider.interface';

/**
 * The order rates are tried in. CoinMarketCap only with a key (an explicit
 * choice); Kraken is the keyless primary and CoinGecko the keyless fallback.
 */
export function orderRateProviders(
  cmcKey: string | undefined,
  p: { cmc: RateProvider; kraken: RateProvider; coinGecko: RateProvider },
): RateProvider[] {
  const keyless = [p.kraken, p.coinGecko];
  return cmcKey ? [p.cmc, ...keyless] : keyless;
}
