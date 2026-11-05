import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import * as QRCode from 'qrcode';
import { ViewsService } from './views.service';
import { InvoiceThrottlerGuard } from './invoice-throttler.guard';

// Runs after the global per-IP guard, adding a per-invoice limit
@Controller()
@UseGuards(InvoiceThrottlerGuard)
@Throttle({ default: { ttl: 60_000, limit: 60 } })
export class ViewsController {
  constructor(private readonly viewsService: ViewsService) {}

  @Get('i/:publicId')
  async landing(
    @Param('publicId', new ParseUUIDPipe({ version: '4' })) publicId: string,
    @Res() res: Response,
  ) {
    const invoice = await this.viewsService.getInvoice(publicId);
    if (!invoice) {
      throw new NotFoundException();
    }

    const qrDataUrl = await QRCode.toDataURL(invoice.address);

    res.render('invoice.njk', { invoice, qrDataUrl });
  }

  @Get('i/:publicId/status')
  async status(
    @Param('publicId', new ParseUUIDPipe({ version: '4' })) publicId: string,
  ) {
    const status = await this.viewsService.getStatus(publicId);
    if (!status) {
      throw new NotFoundException();
    }
    return status;
  }
}
