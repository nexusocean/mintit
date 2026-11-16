import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import { SettingsModule } from '../settings/settings.module';
import { PriceService } from './price.service';
import { CmcRateProvider } from './providers/cmc.provider';
import { CoinGeckoRateProvider } from './providers/coingecko.provider';
import { KrakenRateProvider } from './providers/kraken.provider';
import { RATE_PROVIDER, type RateProvider } from './rate-provider.interface';
import { orderRateProviders } from './provider-order';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({ timeout: 8_000, maxRedirects: 2 }),
    }),
    SettingsModule,
  ],
  providers: [
    PriceService,
    CmcRateProvider,
    CoinGeckoRateProvider,
    KrakenRateProvider,
    {
      provide: RATE_PROVIDER,
      inject: [
        ConfigService,
        KrakenRateProvider,
        CoinGeckoRateProvider,
        CmcRateProvider,
      ],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        kraken: KrakenRateProvider,
        coinGecko: CoinGeckoRateProvider,
        cmc: CmcRateProvider,
      ): RateProvider[] =>
        orderRateProviders(config.get('CMC_API_KEY', { infer: true }), {
          cmc,
          kraken,
          coinGecko,
        }),
    },
  ],
  exports: [PriceService],
})
export class PriceModule {}
