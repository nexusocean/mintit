import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { UserScope } from '@mintit/types';

export enum UserStatus {
  Active = 'active',
  // Invited, or set a password but hasn't finished 2FA setup yet.
  Pending = 'pending',
}

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'staff@example.com' })
  email!: string;

  @ApiProperty({ enum: UserScope, example: UserScope.MANAGER })
  role!: UserScope;

  @ApiProperty({ enum: UserStatus, example: UserStatus.Active })
  status!: UserStatus;

  @ApiProperty()
  createdAt!: Date;
}

export class InviteUserDto {
  @ApiProperty({ example: 'staff@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ enum: UserScope, example: UserScope.MANAGER })
  @IsEnum(UserScope)
  role!: UserScope;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserScope, example: UserScope.ADMIN })
  @IsEnum(UserScope)
  role!: UserScope;
}

export class InviteResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({
    description:
      'Single-use invite token. Share it out of band; it stops working once ' +
      'used, when reissued, or at expiresAt.',
  })
  token!: string;

  @ApiProperty()
  expiresAt!: Date;
}

export class AcceptInviteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'strongpassword', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class AcceptInviteResponseDto {
  @ApiProperty({ example: 'staff@example.com' })
  email!: string;

  @ApiProperty({
    description:
      'When true, finish with /auth/setup and /auth/verify using this email ' +
      'and the new password. When false the account is already active.',
  })
  totpRequired!: boolean;
}
