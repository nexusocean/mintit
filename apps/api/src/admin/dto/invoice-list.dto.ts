import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { InvoiceResponseDto } from '../../invoices/dto/invoice-response.dto';
import { Chain, InvoiceStatus } from '@mintit/types';

export const INVOICE_SORT_FIELDS = [
  'createdAt',
  'expiresAt',
  'amount',
  'status',
  'publicId',
] as const;
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

export class InvoiceListQueryDto {
  @ApiPropertyOptional({
    enum: Chain,
    description: 'Omit to list invoices across all chains',
  })
  @IsOptional()
  @IsEnum(Chain)
  chain?: Chain;

  @ApiPropertyOptional({
    enum: InvoiceStatus,
    isArray: true,
    description: 'One status, or several comma-separated (pending,confirmed)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    (Array.isArray(value) ? value : String(value).split(','))
      .map((s) => String(s).trim())
      .filter(Boolean),
  )
  @IsEnum(InvoiceStatus, { each: true })
  status?: InvoiceStatus[];

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsOptional()
  @IsUUID('4')
  publicId?: string;

  @ApiPropertyOptional({
    enum: INVOICE_SORT_FIELDS,
    default: 'createdAt',
    description:
      'amount sorts by the fiat value; status by lifecycle order ' +
      '(pending, seen, confirmed, underpaid, expired, cancelled)',
  })
  @IsOptional()
  @IsIn(INVOICE_SORT_FIELDS)
  sort?: InvoiceSortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class InvoiceListResponseDto {
  @ApiProperty({ type: [InvoiceResponseDto] })
  data!: InvoiceResponseDto[];

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
