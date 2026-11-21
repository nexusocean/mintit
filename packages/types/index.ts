export enum InvoiceStatus {
  Pending = 'pending',
  Seen = 'seen',
  Confirmed = 'confirmed',
  Underpaid = 'underpaid',
  Expired = 'expired',
  Cancelled = 'cancelled',
}

export enum Chain {
  Xmr = 'xmr',
}

export enum Asset {
  Xmr = 'xmr',
}

export enum UserScope {
  ADMIN = 'admin',
  MANAGER = 'manager',
}

export enum WebhookEvent {
  InvoiceSeen = 'invoice.seen',
  InvoiceConfirmed = 'invoice.confirmed',
  InvoiceUnderpaid = 'invoice.underpaid',
  InvoiceExpired = 'invoice.expired',
  InvoiceCancelled = 'invoice.cancelled',
}

export enum WebhookDeliveryStatus {
  Pending = 'pending',
  Delivered = 'delivered',
  Failed = 'failed',
  DeadLettered = 'dead_lettered',
}

export interface ConfigResponseDto {
  enabledChains: Chain[];
}

export interface InvoiceDto {
  publicId: string;
  chain: Chain;
  asset: Asset;
  assetDecimals: number;
  address: string;
  addressIndex: number;
  amountAtomic: string;
  amountFiat: number;
  fiatCurrency: string;
  rate: number;
  rateLockedAt: string;
  expiresAt: string;
  status: InvoiceStatus;
  confirmationsRequired: number;
  confirmations: number;
  receivedAtomic: string;
  createdAt: string;
  firstSeenAt?: string;
  paidAt?: string;
  webhookUrl?: string;
  chainData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  memo?: string;
}

export interface InvoiceListDto {
  data: InvoiceDto[];
  total: number;
  page: number;
  limit: number;
}

export interface WebhookAttemptDto {
  id: string;
  event: WebhookEvent;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastResponseCode?: number;
  lastError?: string;
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletInfoDto {
  chain: Chain;
  // XMR fields
  primaryAddress?: string;
  viewKey?: string;
  restoreHeight?: number;
  walletHeight?: number;
  daemonHeight?: number;
  synced?: boolean;
}

export interface HealthCheckDto {
  ok: boolean;
  detail?: string;
}

export interface HealthReadyDto {
  status: 'ok' | 'degraded';
  checks: Record<string, HealthCheckDto>;
}

export interface HealthSyncedDto {
  status: 'ok' | 'syncing';
  walletHeight: number;
  daemonHeight: number;
  behind: number;
  detail?: string;
}

export interface GlobalSettingsDto {
  rateCacheTtlMs: number;
  webhookMaxAttempts: number;
  webhookTimeoutMs: number;
  webhookDispatchIntervalMs: number;
  underpaymentToleranceCents: number;
}

export interface SettingsDto extends GlobalSettingsDto {
  confirmationDepth: number;
  invoiceDefaultExpirySec: number;
  scannerLockTtlMs: number;
  syncedThresholdBlocks: number;
}
