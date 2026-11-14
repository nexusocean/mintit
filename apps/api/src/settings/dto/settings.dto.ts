import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GlobalSettingsResponseDto {
  @ApiProperty({ minimum: 0, description: 'Milliseconds' })
  rateCacheTtlMs!: number;

  @ApiProperty({ minimum: 1 })
  webhookMaxAttempts!: number;

  @ApiProperty({ minimum: 1000, description: 'Milliseconds' })
  webhookTimeoutMs!: number;

  @ApiProperty({ minimum: 0, description: 'Milliseconds' })
  webhookDispatchIntervalMs!: number;

  @ApiProperty({
    minimum: 0,
    maximum: 10_000,
    description:
      'Fiat shortfall in cents still accepted as paid (e.g. a fee deducted from the amount). Never more than 10% of an invoice.',
  })
  underpaymentToleranceCents!: number;
}

export class SettingsResponseDto extends GlobalSettingsResponseDto {
  @ApiProperty({ minimum: 1 })
  confirmationDepth!: number;

  @ApiProperty({ minimum: 60, description: 'Seconds' })
  invoiceDefaultExpirySec!: number;

  @ApiProperty({ minimum: 1000, description: 'Milliseconds' })
  scannerLockTtlMs!: number;

  @ApiProperty({ minimum: 1 })
  syncedThresholdBlocks!: number;
}

export class UpdateGlobalSettingsDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  rateCacheTtlMs?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  webhookMaxAttempts?: number;

  @ApiPropertyOptional({ minimum: 1000 })
  @IsInt()
  @Min(1000)
  @IsOptional()
  webhookTimeoutMs?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  webhookDispatchIntervalMs?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10_000 })
  @IsInt()
  @Min(0)
  @Max(10_000)
  @IsOptional()
  underpaymentToleranceCents?: number;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  confirmationDepth?: number;

  @ApiPropertyOptional({ minimum: 60 })
  @IsInt()
  @Min(60)
  @IsOptional()
  invoiceDefaultExpirySec?: number;

  @ApiPropertyOptional({ minimum: 1000 })
  @IsInt()
  @Min(1000)
  @IsOptional()
  scannerLockTtlMs?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  syncedThresholdBlocks?: number;
}
