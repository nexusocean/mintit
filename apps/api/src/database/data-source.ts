import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../auth/schemas/user.entity';
import { BackupCode } from '../auth/schemas/backup-code.entity';
import { Invoice } from '../invoices/schemas/invoice.entity';
import { Payment } from '../payments/schemas/payment.entity';
import { ScannerLock } from '../scanner/schemas/scanner-lock.entity';
import { Settings } from '../settings/schemas/settings.entity';
import { WebhookDelivery } from '../webhooks/schemas/webhook-delivery.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    BackupCode,
    Invoice,
    Payment,
    ScannerLock,
    Settings,
    WebhookDelivery,
  ],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  // Ids default to gen_random_uuid() (built into Postgres 13+). Telling
  // TypeORM so keeps it from seeing schema drift on every primary key, and
  // there's no extension to install.
  uuidExtension: 'pgcrypto',
  installExtensions: false,
});
