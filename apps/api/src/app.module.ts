import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { PriceModule } from './price/price.module';
import { InvoicesModule } from './invoices/invoices.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { SettingsModule } from './settings/settings.module';
import { ChainsModule } from './chains/chains.module';
import { Chain } from '@mintit/types';
import { ViewsModule } from './views/views.module';

const enabledChains = (process.env.ENABLED_CHAINS ?? '')
  .split(',')
  .map((c) => c.trim().toLowerCase());

const chainModules: DynamicModule[] = [];

if (enabledChains.includes(Chain.Xmr)) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MoneroModule } = require('./monero/monero.module');
  chainModules.push(MoneroModule);
}

console.log('enabledChains from env:', enabledChains);

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Per-IP baseline for every route, counted per handler.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    AppConfigModule,
    DatabaseModule,
    ChainsModule,
    ...chainModules,
    AuthModule,
    PriceModule,
    InvoicesModule,
    WebhooksModule,
    AdminModule,
    HealthModule,
    SettingsModule,
    ViewsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
