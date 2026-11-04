import { ApiProperty } from '@nestjs/swagger';

export class StatsResponseDto {
  @ApiProperty({
    example: '500000000',
    description: 'Total confirmed volume in atomic units',
  })
  confirmedVolumeAtomic!: string;
}
