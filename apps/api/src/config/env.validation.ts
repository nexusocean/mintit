import { Chain } from '@mintit/types';
import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsHexadecimal,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum MoneroNetwork {
  Stagenet = 'stagenet',
  Mainnet = 'mainnet',
}

export enum RateProvider {
  Cmc = 'cmc',
}

const toInt = ({ value }: { value: unknown }): number =>
  typeof value === 'number' ? value : parseInt(String(value), 10);

const toBool = ({ value }: { value: unknown }): boolean => {
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
};

const toChainArray = ({ value }: { value: unknown }): Chain[] => {
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return raw.map((v) => v.trim().toLowerCase()) as Chain[];
};

export class EnvironmentVariables {
  // --- App ---
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Transform(toInt)
  @IsInt()
  @IsOptional()
  PORT: number = 3000;

  // --- Postgres ---
  @IsString()
  DATABASE_URL!: string;

  // --- Monero network ---
  @IsEnum(MoneroNetwork)
  @IsOptional()
  MONERO_NETWORK: MoneroNetwork = MoneroNetwork.Stagenet;

  // --- monerod ---
  @IsUrl({ require_tld: false, require_protocol: true })
  @IsOptional()
  MONERO_DAEMON_URI?: string;

  @IsString()
  @IsOptional()
  MONERO_DAEMON_USER?: string;

  @IsString()
  @IsOptional()
  MONERO_DAEMON_PASSWORD?: string;

  // --- Wallet (view-only, in-process MoneroWalletFull) ---
  @IsString()
  @IsOptional()
  MONERO_WALLET_PATH?: string;

  @IsHexadecimal()
  @Length(64, 64)
  @IsOptional()
  MONERO_VIEW_KEY?: string;

  @IsString()
  @IsOptional()
  MONERO_PRIMARY_ADDRESS?: string;

  @Transform(toInt)
  @IsInt()
  @Min(0)
  @IsOptional()
  MONERO_RESTORE_HEIGHT?: number;

  // --- Additional Pricing ---
  @IsString()
  @IsOptional()
  CMC_API_KEY?: string;

  // --- API auth ---
  @IsString()
  @MinLength(16)
  API_KEY!: string;

  @IsString()
  @IsOptional()
  DEMO_ADMIN_TOTP?: string;

  /** Dev only: skip TOTP for registration and login. Refused in production. */
  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  AUTH_DISABLE_TOTP: boolean = false;

  // --- Webhooks ---
  @IsString()
  WEBHOOK_SIGNING_SECRET!: string;

  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  MONERO_PREWARM_SYNC: boolean = true;

  // --- Enabled chains ---
  @Transform(toChainArray)
  @IsEnum(Chain, { each: true })
  ENABLED_CHAINS!: Chain[];
}

export const validateEnv = (
  config: Record<string, unknown>,
): EnvironmentVariables => {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n${errors.toString()}`);
  }

  if (
    validated.AUTH_DISABLE_TOTP &&
    validated.NODE_ENV === NodeEnv.Production
  ) {
    throw new Error('AUTH_DISABLE_TOTP cannot be enabled in production');
  }

  if (!validated.ENABLED_CHAINS?.length) {
    throw new Error('ENABLED_CHAINS must specify at least one chain');
  }

  if (validated.ENABLED_CHAINS.includes(Chain.Xmr)) {
    const missing = [
      'MONERO_DAEMON_URI',
      'MONERO_DAEMON_USER',
      'MONERO_DAEMON_PASSWORD',
      'MONERO_WALLET_PATH',
    ].filter((k) => !validated[k as keyof EnvironmentVariables]);
    if (missing.length) {
      throw new Error(
        `XMR enabled but missing required vars: ${missing.join(', ')}`,
      );
    }
  }

  return validated;
};
