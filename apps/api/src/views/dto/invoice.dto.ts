import { ApiProperty } from '@nestjs/swagger';
import { Asset, Chain, InvoiceStatus } from '@mintit/types';

export class PublicInvoiceResponseDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  publicId!: string;

  @ApiProperty({ enum: Chain })
  chain!: Chain;

  @ApiProperty({ enum: Asset })
  asset!: Asset;

  @ApiProperty()
  assetDecimals!: number;

  @ApiProperty()
  address!: string;

  @ApiProperty()
  amountAtomic!: string;

  @ApiProperty()
  amountFormatted: string;

  @ApiProperty()
  amountFiat!: string;

  @ApiProperty()
  fiatCurrency!: string;

  @ApiProperty()
  rate!: number;

  @ApiProperty({
    description: 'Price of 1 unit of the asset in fiat, e.g. "320.45"',
  })
  fiatPerAsset!: string;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty()
  confirmations!: number;

  @ApiProperty()
  confirmationsRequired!: number;

  @ApiProperty()
  receivedAtomic!: string;

  @ApiProperty({ description: 'Expiry formatted in UTC (no-JS fallback)' })
  expiresAt!: string;

  @ApiProperty({ description: 'Expiry as ISO 8601, localised by checkout.js' })
  expiresAtIso!: string;

  @ApiProperty({ required: false })
  memo?: string;
}
