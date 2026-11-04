import { Chain } from '@mintit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WalletInfoResponseDto {
  @ApiProperty({ enum: Chain, example: Chain.Xmr })
  chain!: Chain;

  // XMR fields
  @ApiPropertyOptional({ example: '5A1...' })
  primaryAddress?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3...64hex',
    description: 'Private view key (read-only; cannot spend funds)',
  })
  viewKey?: string;

  @ApiPropertyOptional({ example: 1234567 })
  restoreHeight?: number;

  @ApiPropertyOptional({ example: 1234890 })
  walletHeight?: number;

  @ApiPropertyOptional({ example: 1234892 })
  daemonHeight?: number;

  @ApiPropertyOptional({ example: true })
  synced?: boolean;
}
