import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { validate as isValidUuid } from 'uuid';
import { Invoice } from './schemas/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';
import { PriceService } from '../price/price.service';
import { ChainsService } from '../chains/chains.service';
import { SettingsService } from '../settings/settings.service';
import BigNumber from 'bignumber.js';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WebhookEvent } from '../webhooks/schemas/webhook-delivery.entity';
import { Asset, Chain, InvoiceStatus } from '@mintit/types';
import { randomUUID } from 'crypto';

const CHAIN_CONFIG = {
  [Chain.Xmr]: { asset: Asset.Xmr, decimals: 12, symbol: 'XMR' },
} as const;

@Injectable()
export class InvoicesService {
  private readonly log = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoices: Repository<Invoice>,
    private readonly price: PriceService,
    private readonly chains: ChainsService,
    private readonly settings: SettingsService,
    private readonly webhooks: WebhooksService,
  ) {}

  async create(dto: CreateInvoiceDto): Promise<InvoiceResponseDto> {
    let publicId = dto.publicId;

    try {
      if (dto.publicId) return await this.findByPublicId(dto.publicId);
      publicId = randomUUID();
    } catch (err) {
      if (!(err instanceof NotFoundException)) throw err;
    }

    const chain = dto.chain;

    const defaultExpiry = this.settings.get(chain, 'invoiceDefaultExpirySec');
    const defaultConfirmations = this.settings.get(chain, 'confirmationDepth');
    const expiresIn = dto.expiresInSeconds ?? defaultExpiry;

    const { asset, decimals, symbol } = CHAIN_CONFIG[chain];
    // TODO: read from config BASE_FIAT_CURRENCY
    const fiatCurrency = 'USD';

    let quote: Awaited<ReturnType<typeof this.price.getQuote>>;
    try {
      quote = await this.price.getQuote(symbol, fiatCurrency);
    } catch (err) {
      throw new BadRequestException(
        `Price feed unavailable: ${(err as Error).message}`,
      );
    }

    let amountAtomic: string;
    let amountFiat: number;

    if (dto.amountAtomic) {
      amountAtomic = dto.amountAtomic;
      const units = new BigNumber(amountAtomic).dividedBy(
        new BigNumber(10).pow(decimals),
      );
      amountFiat = units.multipliedBy(quote.fiatPerAsset).toNumber();
    } else {
      amountAtomic = this.price.convertFiatToAtomic(
        dto.fiatAmount!,
        quote,
        decimals,
      );
      amountFiat = dto.fiatAmount!;
    }

    const rate = quote.assetPerFiat;
    const rateLockedAt = quote.fetchedAt;

    const { address, addressIndex } = await this.chains
      .get(chain)
      .resolveAddress(`invoice:${rateLockedAt.toISOString()}`);

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const created = await this.invoices.save(
      this.invoices.create({
        publicId,
        chain,
        asset,
        assetDecimals: decimals,
        address,
        addressIndex,
        amountAtomic,
        amountFiat,
        fiatCurrency,
        rate,
        rateLockedAt,
        expiresAt,
        confirmationsRequired:
          dto.confirmationsRequired ?? defaultConfirmations,
        webhookUrl: dto.webhookUrl,
        metadata: dto.metadata,
        memo: dto.memo,
      }),
    );

    return this.toResponse(created);
  }

  async findByPublicId(publicId: string): Promise<InvoiceResponseDto> {
    return this.toResponse(await this.getByPublicId(publicId));
  }

  /**
   * Only a pending, unexpired invoice can be cancelled: once a payment is seen
   * the money is on its way, and an expired one is already closed.
   */
  async cancel(publicId: string): Promise<InvoiceResponseDto> {
    const inv = await this.getByPublicId(publicId);

    // Conditional on the status, so a payment the scanner records at the same
    // moment wins instead of being overwritten.
    const { affected } = await this.invoices.update(
      {
        id: inv.id,
        status: InvoiceStatus.Pending,
        expiresAt: MoreThan(new Date()),
      },
      { status: InvoiceStatus.Cancelled },
    );
    if (!affected) {
      throw new ConflictException('Only pending invoices can be cancelled');
    }

    if (inv.webhookUrl) {
      await this.webhooks.enqueue(
        inv.id,
        inv.webhookUrl,
        WebhookEvent.InvoiceCancelled,
        {
          publicId: inv.publicId,
          chain: inv.chain,
          asset: inv.asset,
          assetDecimals: inv.assetDecimals,
          status: InvoiceStatus.Cancelled,
          address: inv.address,
        },
      );
    }

    return this.toResponse({ ...inv, status: InvoiceStatus.Cancelled });
  }

  private async getByPublicId(publicId: string): Promise<Invoice> {
    const inv = isValidUuid(publicId)
      ? await this.invoices.findOne({ where: { publicId } })
      : null;
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  private toResponse(inv: Invoice): InvoiceResponseDto {
    return {
      publicId: inv.publicId,
      chain: inv.chain,
      asset: inv.asset,
      assetDecimals: inv.assetDecimals,
      address: inv.address,
      addressIndex: inv.addressIndex,
      amountAtomic: inv.amountAtomic,
      amountFiat: inv.amountFiat,
      fiatCurrency: inv.fiatCurrency,
      rate: inv.rate,
      rateLockedAt: inv.rateLockedAt.toISOString(),
      expiresAt: inv.expiresAt.toISOString(),
      status: inv.status,
      confirmationsRequired: inv.confirmationsRequired,
      confirmations: inv.confirmations,
      receivedAtomic: inv.receivedAtomic,
      firstSeenAt: inv.firstSeenAt?.toISOString(),
      paidAt: inv.paidAt?.toISOString(),
      webhookUrl: inv.webhookUrl,
      chainData: inv.chainData,
      metadata: inv.metadata,
      memo: inv.memo,
      createdAt: (
        inv as unknown as { createdAt: Date }
      ).createdAt.toISOString(),
    };
  }
}
