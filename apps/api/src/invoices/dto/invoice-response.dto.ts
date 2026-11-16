import { Asset, Chain, InvoiceStatus } from '@mintit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceResponseDto {
  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description:
      'The invoice ID: used in the payment link, the API and webhooks',
  })
  publicId!: string;

  @ApiProperty({ enum: Chain, example: Chain.Xmr })
  chain!: Chain;

  @ApiProperty({ enum: Asset, example: Asset.Xmr })
  asset!: Asset;

  @ApiProperty({ example: 12, description: 'Decimals for atomic conversion' })
  assetDecimals!: number;

  @ApiProperty({
    example: '5A1jR...subaddress...xyz',
    description: 'Unique receiving address for this invoice',
  })
  address!: string;

  @ApiProperty({
    example: 1,
    description: 'Address index (XMR subaddress index or HD derivation index)',
  })
  addressIndex!: number;

  @ApiProperty({
    example: '123456789012',
    description: 'Amount owed in atomic units (string)',
  })
  amountAtomic!: string;

  @ApiProperty({ example: 19.99 })
  amountFiat!: number;

  @ApiProperty({ example: 'USD' })
  fiatCurrency!: string;

  @ApiProperty({
    example: 0.00617,
    description: 'Asset per 1 unit fiat at lock time',
  })
  rate!: number;

  @ApiProperty({ example: '2026-05-06T12:34:56.000Z' })
  rateLockedAt!: string;

  @ApiProperty({ example: '2026-05-06T12:54:56.000Z' })
  expiresAt!: string;

  @ApiProperty({ enum: InvoiceStatus, example: InvoiceStatus.Pending })
  status!: InvoiceStatus;

  @ApiProperty({ example: 1 })
  confirmationsRequired!: number;

  @ApiProperty({ example: 0 })
  confirmations!: number;

  @ApiProperty({
    example: '0',
    description: 'Total atomic units received across all payments',
  })
  receivedAtomic!: string;

  @ApiPropertyOptional({ example: '2026-05-06T12:36:01.000Z' })
  firstSeenAt?: string;

  @ApiPropertyOptional({ example: '2026-05-06T12:38:14.000Z' })
  paidAt?: string;

  @ApiPropertyOptional({ example: 'https://merchant.example.com/hook' })
  webhookUrl?: string;

  @ApiPropertyOptional({ example: 'Invoice #1042 for consulting services' })
  memo?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Chain-specific data (e.g. txHash, blockNumber for EVM)',
  })
  chainData?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata?: Record<string, unknown>;

  @ApiProperty({ example: '2026-05-06T12:34:56.000Z' })
  createdAt!: string;
}
