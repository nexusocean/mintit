import { Module } from '@nestjs/common';
import { ViewsController } from './views.controller';
import { ViewsService } from './views.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../invoices/schemas/invoice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice])],
  controllers: [ViewsController],
  providers: [ViewsService],
})
export class ViewsModule {}
