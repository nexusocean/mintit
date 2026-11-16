import { ApiProperty } from '@nestjs/swagger';
import { UserScope } from '@mintit/types';

export class StatusResponseDto {
  @ApiProperty({ example: true })
  registered: boolean;

  @ApiProperty({
    example: true,
    description: 'False when AUTH_DISABLE_TOTP is set (dev only)',
  })
  totpRequired: boolean;

  @ApiProperty({
    example: false,
    description:
      'True when DEMO_ADMIN_TOTP is set; profile updates are refused',
  })
  profileLocked: boolean;
}

export class MeResponseDto {
  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ enum: UserScope, example: UserScope.ADMIN })
  role: UserScope;
}

export class UpdateResponseDto {
  @ApiProperty({ example: 'admin@example.com' })
  email: string;
}

export class TotpStatusResponseDto {
  @ApiProperty({ example: 8, description: 'Unused, confirmed backup codes' })
  backupCodesRemaining: number;
}

export class TotpSetupResponseDto {
  @ApiProperty()
  qrCode: string;

  @ApiProperty()
  secret: string;

  @ApiProperty({ type: [String] })
  backupCodes: string[];
}
