import { ApiProperty } from '@nestjs/swagger';

/** The chain settings a new invoice starts from, without the rest of the settings. */
export class InvoiceDefaultsResponseDto {
  @ApiProperty({ minimum: 60, description: 'Seconds' })
  invoiceDefaultExpirySec!: number;

  @ApiProperty({ minimum: 1 })
  confirmationDepth!: number;
}
