import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { validate as isValidUuid } from 'uuid';
import { Invoice } from './schemas/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';
import { PriceService } from '../price/price.service';
import { ChainsService } from '../chains/chains.service';
import { SettingsService } from '../settings/settings.service';
import BigNumber from 'bignumber.js';
import { Asset, Chain } from '@mintit/types';

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
  ) {}

  async create(dto: CreateInvoiceDto): Promise<InvoiceResponseDto> {
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

  async findById(id: string): Promise<InvoiceResponseDto> {
    if (!isValidUuid(id)) {
      throw new NotFoundException('Invoice not found');
    }
    const inv = await this.invoices.findOne({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    return this.toResponse(inv);
  }

  private toResponse(inv: Invoice): InvoiceResponseDto {
    return {
      id: inv.id,
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
