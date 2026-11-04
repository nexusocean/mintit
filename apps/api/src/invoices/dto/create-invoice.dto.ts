import {
  IsString,
  IsInt,
  IsUrl,
  IsNumber,
  Min,
  MaxLength,
  IsObject,
  Matches,
  IsEnum,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Chain } from '@mintit/types';

function ExactlyOneOf(peers: string[], validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'exactlyOneOf',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      target: (object as { constructor: Function }).constructor,
      propertyName,
      constraints: peers,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          const presentCount = args.constraints.filter(
            (key) => obj[key] !== undefined && obj[key] !== null,
          ).length;
          return presentCount === 1;
        },
        defaultMessage(args: ValidationArguments) {
          return `Exactly one of [${args.constraints.join(', ')}] must be provided`;
        },
      },
    });
  };
}

export class CreateInvoiceDto {
  @ApiProperty({
    example: Chain.Xmr,
    description: 'Chain to create the invoice on',
    enum: Chain,
  })
  @IsEnum(Chain)
  chain!: Chain;

  @ApiPropertyOptional({
    example: 19.99,
    description:
      'Amount in fiat (USD). Exactly one of fiatAmount or amountAtomic must be provided. The fiat equivalent is always recorded on the invoice.',
  })
  @ExactlyOneOf(['fiatAmount', 'amountAtomic'], {
    message: 'Exactly one of [fiatAmount, amountAtomic] must be provided',
  })
  @ValidateIf((o) => o.fiatAmount !== undefined)
  @IsNumber()
  @Min(0.01)
  fiatAmount?: number;

  @ApiPropertyOptional({
    example: '123456789012',
    description:
      'Amount in atomic units (string, BigInt-compatible). Exactly one of fiatAmount or amountAtomic must be provided. The USD fiat equivalent is recorded on the invoice at creation time. Piconero for XMR (1 XMR = 10^12).',
  })
  @ValidateIf((o) => o.amountAtomic !== undefined)
  @IsString()
  @Matches(/^[1-9][0-9]*$/, {
    message: 'amountAtomic must be a positive integer string',
  })
  amountAtomic?: string;

  @ApiPropertyOptional({
    example: 1200,
    description: 'Expiry in seconds (default 20 min)',
    minimum: 60,
  })
  @ValidateIf((o) => o.expiresInSeconds !== undefined)
  @IsInt()
  @Min(60)
  expiresInSeconds?: number;

  @ApiPropertyOptional({
    example: 3,
    description:
      'Override confirmations required. Defaults to the chain settings value.',
    minimum: 1,
  })
  @ValidateIf((o) => o.confirmationsRequired !== undefined)
  @IsInt()
  @Min(1)
  confirmationsRequired?: number;

  @ApiPropertyOptional({
    example: 'https://webhook.site/xmr/hook',
    description: 'Webhook callback URL',
  })
  @ValidateIf((o) => o.webhookUrl !== undefined)
  @IsUrl({ require_tld: false, require_protocol: true })
  webhookUrl?: string;

  @ApiPropertyOptional({
    example: { orderId: 'ORD-1234' },
    type: 'object',
    additionalProperties: true,
  })
  @ValidateIf((o) => o.metadata !== undefined)
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'Invoice #1042 for consulting services',
    description: 'Payer-facing note shown on the hosted checkout page',
    maxLength: 280,
  })
  @ValidateIf((o) => o.memo !== undefined)
  @IsString()
  @MaxLength(280)
  memo?: string;
}
