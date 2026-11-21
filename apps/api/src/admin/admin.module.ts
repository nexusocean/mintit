import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { Invoice } from '../invoices/schemas/invoice.entity';
import { InvoicesModule } from '../invoices/invoices.module';
import { SettingsModule } from '../settings/settings.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Invoice]),
    InvoicesModule,
    SettingsModule,
    WebhooksModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
