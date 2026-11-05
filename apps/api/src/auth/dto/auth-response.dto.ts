import { ApiProperty } from '@nestjs/swagger';

export class StatusResponseDto {
  @ApiProperty({ example: true })
  registered: boolean;

  @ApiProperty({
    example: true,
    description: 'False when AUTH_DISABLE_TOTP is set (dev only)',
  })
  totpRequired: boolean;
}

export class MeResponseDto {
  @ApiProperty({ example: 'admin@example.com' })
  email: string;
}

export class UpdateResponseDto {
  @ApiProperty({ example: 'admin@example.com' })
  email: string;
}

export class TotpSetupResponseDto {
  @ApiProperty()
  qrCode: string;

  @ApiProperty()
  secret: string;

  @ApiProperty({ type: [String] })
  backupCodes: string[];
}
