import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsString,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'strongpassword', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'strongpassword' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'TOTP or backup code. Omit only when TOTP is disabled.',
  })
  @IsString()
  @IsOptional()
  token?: string;
}

export class UpdateDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ description: 'New password', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsOptional()
  newPassword?: string;
}

export class TotpSetupDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class TotpVerifyDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class TotpResetDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class TotpResetConfirmDto {
  @ApiProperty({
    example: '123456',
    description: 'Code from the new authenticator secret',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
