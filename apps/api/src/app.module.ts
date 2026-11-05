import { Module } from '@nestjs/common';
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
import { ViewsModule } from './views/views.module';
import { MoneroModule } from './monero/monero.module';
import { DashboardModule } from './dashboard/dashboard.module';

const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Per-IP baseline for every route.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    AppConfigModule,
    DatabaseModule,
    ChainsModule,
    MoneroModule,
    AuthModule,
    PriceModule,
    InvoicesModule,
    WebhooksModule,
    AdminModule,
    HealthModule,
    SettingsModule,
    ViewsModule,
    ...(isProd ? [DashboardModule] : []),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
