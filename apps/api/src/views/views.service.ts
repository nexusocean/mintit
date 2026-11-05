import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../invoices/schemas/invoice.entity';
import { PublicInvoiceResponseDto } from './dto/invoice.dto';
import { PublicInvoiceStatusDto } from './dto/status.dto';

@Injectable()
export class ViewsService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async getInvoice(publicId: string): Promise<PublicInvoiceResponseDto | null> {
    const doc = await this.invoiceRepo.findOne({ where: { publicId } });
    if (!doc) return null;

    return {
      publicId: doc.publicId,
      chain: doc.chain,
      asset: doc.asset,
      assetDecimals: doc.assetDecimals,
      address: doc.address,
      amountAtomic: doc.amountAtomic,
      amountFormatted: this.formatAtomic(
        doc.amountAtomic,
        doc.assetDecimals,
        doc.asset,
        6,
      ),
      amountFiat: doc.amountFiat.toFixed(2),
      fiatCurrency: doc.fiatCurrency,
      rate: doc.rate,
      rateFormatted: this.formatRate(doc.rate),
      status: doc.status,
      confirmations: doc.confirmations,
      confirmationsRequired: doc.confirmationsRequired,
      receivedAtomic: doc.receivedAtomic,
      expiresAt: this.formatDate(doc.expiresAt),
      expiresAtIso: doc.expiresAt.toISOString(),
      memo: doc.memo,
    };
  }

  async getStatus(publicId: string): Promise<PublicInvoiceStatusDto | null> {
    const doc = await this.invoiceRepo.findOne({
      where: { publicId },
      select: [
        'status',
        'confirmations',
        'confirmationsRequired',
        'receivedAtomic',
      ],
    });
    if (!doc) return null;

    return {
      status: doc.status,
      confirmations: doc.confirmations,
      confirmationsRequired: doc.confirmationsRequired,
      receivedAtomic: doc.receivedAtomic,
    };
  }

  private formatAtomic(
    atomic: string,
    decimals: number,
    ticker: string,
    displayDecimals = 2,
  ): string {
    const divisor = Math.pow(10, decimals);
    const value = Number(atomic) / divisor;
    const scale = Math.pow(10, displayDecimals);
    const rounded = Math.ceil(value * scale) / scale;

    let val = rounded.toFixed(displayDecimals);
    // trim trailing zeros but stop at minDecimals
    if (val.includes('.')) {
      val = val.replace(/0+$/, '');
      const [whole, frac = ''] = val.split('.');
      val =
        frac.length < displayDecimals
          ? `${whole}.${frac.padEnd(displayDecimals, '0')}`
          : val.replace(/\.$/, '');
    }

    return val;
  }

  // Server-side the visitor's time zone is unknown, so render UTC explicitly;
  // checkout.js swaps in the visitor's local time when JS is available.
  private formatDate(date: Date) {
    // dateStyle/timeStyle can't be combined with timeZoneName, so spell out
    // the parts (same format checkout.js uses).
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
  }

  private formatRate(rate: number): string {
    return rate.toPrecision(6);
  }
}
