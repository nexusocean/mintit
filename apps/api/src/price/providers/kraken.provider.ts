import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { RateProvider } from '../rate-provider.interface';

interface KrakenTickerResponse {
  error: string[];
  result?: {
    // Kraken answers under its own pair name (e.g. XXMRZUSD for XMRUSD).
    [pair: string]: {
      /** Last trade closed: [price, lot volume] */
      c: [string, string];
    };
  };
}

@Injectable()
export class KrakenRateProvider implements RateProvider {
  readonly source = 'kraken';
  private readonly baseUrl = 'https://api.kraken.com/0/public';

  constructor(private readonly http: HttpService) {}

  async getRate(asset: string, fiat: string): Promise<number> {
    const pair = `${asset.toUpperCase()}${fiat.toUpperCase()}`;

    const response = await firstValueFrom(
      this.http.get<KrakenTickerResponse>(`${this.baseUrl}/Ticker`, {
        params: { pair },
      }),
    );

    const body = response.data;
    if (body.error?.length) {
      throw new Error(`Kraken error for ${pair}: ${body.error.join(', ')}`);
    }
    const ticker = Object.values(body.result ?? {})[0];
    const price = Number(ticker?.c?.[0]);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Kraken returned invalid price for ${pair}`);
    }
    return price;
  }
}
