import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { RateProvider } from '../rate-provider.interface';

interface CoinGeckoSimplePriceResponse {
  [coinId: string]: {
    [fiat: string]: number;
  };
}

const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  XMR: 'monero',
};

@Injectable()
export class CoinGeckoRateProvider implements RateProvider {
  readonly source = 'coingecko';
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';

  constructor(private readonly http: HttpService) {}

  async getRate(asset: string, fiat: string): Promise<number> {
    const coinId = SYMBOL_TO_COINGECKO_ID[asset.toUpperCase()];
    if (!coinId) {
      throw new Error(`No CoinGecko ID mapping for asset: ${asset}`);
    }

    const response = await firstValueFrom(
      this.http.get<CoinGeckoSimplePriceResponse>(
        `${this.baseUrl}/simple/price`,
        {
          params: {
            ids: coinId,
            vs_currencies: fiat.toLowerCase(),
          },
        },
      ),
    );

    const price = response.data?.[coinId]?.[fiat.toLowerCase()];
    if (typeof price !== 'number' || price <= 0) {
      throw new Error(`CoinGecko returned invalid price for ${asset}/${fiat}`);
    }

    return price;
  }
}
