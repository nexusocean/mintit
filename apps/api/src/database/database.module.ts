import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import { User } from '../auth/schemas/user.entity';
import { BackupCode } from '../auth/schemas/backup-code.entity';
import { Invoice } from '../invoices/schemas/invoice.entity';
import { Payment } from '../payments/schemas/payment.entity';
import { ScannerLock } from '../scanner/schemas/scanner-lock.entity';
import { Settings } from '../settings/schemas/settings.entity';
import { WebhookDelivery } from '../webhooks/schemas/webhook-delivery.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        type: 'postgres' as const,
        url: config.get('DATABASE_URL', { infer: true }),
        entities: [
          User,
          BackupCode,
          Invoice,
          Payment,
          ScannerLock,
          Settings,
          WebhookDelivery,
        ],
        synchronize: false,
        migrationsRun: true,
        migrations: [__dirname + '/migrations/*.js'],
      }),
    }),
  ],
})
export class DatabaseModule {}
