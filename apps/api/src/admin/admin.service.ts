import { NotFoundException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { ChainsService } from '../chains/chains.service';
import { WalletInfoResponseDto } from './dto/wallet-info.dto';
import {
  InvoiceListQueryDto,
  type InvoiceSortField,
  InvoiceListResponseDto,
} from './dto/invoice-list.dto';
import { Invoice } from '../invoices/schemas/invoice.entity';
import { StatsResponseDto } from './dto/wallet-stats.dto';
import { Chain, InvoiceStatus } from '@mintit/types';
import { InvoiceResponseDto } from '../invoices/dto/invoice-response.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateInvoiceDto } from '../invoices/dto/create-invoice.dto';

const SORT_COLUMNS: Record<InvoiceSortField, keyof Invoice> = {
  createdAt: 'createdAt',
  expiresAt: 'expiresAt',
  publicId: 'publicId',
  // amountAtomic is a string column; the fiat value sorts numerically.
  amount: 'amountFiat',
  // Postgres orders enums by declaration, i.e. lifecycle order.
  status: 'status',
};

@Injectable()
export class AdminService {
  constructor(
    private readonly chains: ChainsService,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    private readonly invoices: InvoicesService,
  ) {}

  async createInvoice(dto: CreateInvoiceDto): Promise<InvoiceResponseDto> {
    return this.invoices.create(dto);
  }

  async cancelInvoice(publicId: string): Promise<InvoiceResponseDto> {
    await this.invoices.cancel(publicId);
    return this.getInvoice(publicId);
  }

  async getWalletInfo(chain: Chain): Promise<WalletInfoResponseDto> {
    return this.chains.get(chain).getWalletInfo();
  }

  async getStats(chain: Chain): Promise<StatsResponseDto> {
    const raw = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .select('COALESCE(SUM(invoice."receivedAtomic"::numeric), 0)', 'total')
      .where('invoice.chain = :chain', { chain })
      .andWhere('invoice.status = :status', {
        status: InvoiceStatus.Confirmed,
      })
      .getRawOne<{ total: string }>();

    return { confirmedVolumeAtomic: raw?.total ?? '0' };
  }

  async listInvoices(
    query: InvoiceListQueryDto,
  ): Promise<InvoiceListResponseDto> {
    const {
      status,
      page = 1,
      limit = 20,
      chain,
      publicId,
      sort = 'createdAt',
      order = 'desc',
    } = query;
    const where: FindOptionsWhere<Invoice> = {};

    if (publicId) {
      where.publicId = publicId;
    } else {
      if (chain) where.chain = chain;
      if (status?.length) where.status = In(status);
    }

    const skip = (page - 1) * limit;

    const [docs, total] = await this.invoiceRepo.findAndCount({
      where,
      // Newest first breaks ties, then id so pages never overlap or skip.
      order: {
        [SORT_COLUMNS[sort]]: order === 'asc' ? 'ASC' : 'DESC',
        ...(sort !== 'createdAt' && { createdAt: 'DESC' }),
        id: 'ASC',
      },
      skip,
      take: limit,
    });

    const data = docs.map((doc) => ({
      publicId: doc.publicId,
      chain: doc.chain,
      asset: doc.asset,
      assetDecimals: doc.assetDecimals,
      address: doc.address,
      addressIndex: doc.addressIndex,
      amountAtomic: doc.amountAtomic,
      amountFiat: doc.amountFiat,
      fiatCurrency: doc.fiatCurrency,
      rate: doc.rate,
      rateLockedAt: doc.rateLockedAt.toISOString(),
      expiresAt: doc.expiresAt.toISOString(),
      status: doc.status,
      confirmationsRequired: doc.confirmationsRequired,
      confirmations: doc.confirmations,
      receivedAtomic: doc.receivedAtomic,
      ...(doc.firstSeenAt && { firstSeenAt: doc.firstSeenAt.toISOString() }),
      ...(doc.paidAt && { paidAt: doc.paidAt.toISOString() }),
      ...(doc.webhookUrl && { webhookUrl: doc.webhookUrl }),
      ...(doc.chainData && { chainData: doc.chainData }),
      ...(doc.metadata && { metadata: doc.metadata }),
      createdAt: doc.createdAt.toISOString(),
    }));

    return { data, total, page, limit };
  }

  async getInvoice(publicId: string): Promise<InvoiceResponseDto> {
    const doc = await this.invoiceRepo.findOne({ where: { publicId } });

    if (!doc) {
      throw new NotFoundException('Invoice not found');
    }

    return {
      publicId: doc.publicId,
      chain: doc.chain,
      asset: doc.asset,
      assetDecimals: doc.assetDecimals,
      address: doc.address,
      addressIndex: doc.addressIndex,
      amountAtomic: doc.amountAtomic,
      amountFiat: doc.amountFiat,
      fiatCurrency: doc.fiatCurrency,
      rate: doc.rate,
      rateLockedAt: doc.rateLockedAt.toISOString(),
      expiresAt: doc.expiresAt.toISOString(),
      status: doc.status,
      confirmationsRequired: doc.confirmationsRequired,
      confirmations: doc.confirmations,
      receivedAtomic: doc.receivedAtomic,
      ...(doc.firstSeenAt && { firstSeenAt: doc.firstSeenAt.toISOString() }),
      ...(doc.paidAt && { paidAt: doc.paidAt.toISOString() }),
      ...(doc.webhookUrl && { webhookUrl: doc.webhookUrl }),
      ...(doc.chainData && { chainData: doc.chainData }),
      ...(doc.metadata && { metadata: doc.metadata }),
      createdAt: doc.createdAt.toISOString(),
    };
  }
}
