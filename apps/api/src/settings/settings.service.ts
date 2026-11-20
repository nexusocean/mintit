import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Settings } from './schemas/settings.entity';
import type { EnvironmentVariables } from '../config/env.validation';
import { TUNABLE_DEFAULTS } from '../config/tunable-defaults';
import { Chain } from '@mintit/types';

export interface GlobalSettingsFields {
  rateCacheTtlMs: number;
  webhookMaxAttempts: number;
  webhookTimeoutMs: number;
  webhookDispatchIntervalMs: number;
  /** Fiat shortfall (in cents) still accepted as paid, e.g. a fee taken out of the amount. */
  underpaymentToleranceCents: number;
}

export interface SettingsFields extends GlobalSettingsFields {
  confirmationDepth: number;
  invoiceDefaultExpirySec: number;
  scannerLockTtlMs: number;
  syncedThresholdBlocks: number;
}

const GLOBAL_KEY = 'global' as const;

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly log = new Logger(SettingsService.name);
  private cache = new Map<
    Chain | typeof GLOBAL_KEY,
    SettingsFields | GlobalSettingsFields
  >();

  constructor(
    @InjectRepository(Settings)
    private readonly repo: Repository<Settings>,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadGlobal();
    const chains = this.config.get<Chain[]>('ENABLED_CHAINS') ?? [];
    for (const chain of chains) {
      await this.load(chain);
    }
  }

  async loadGlobal(): Promise<void> {
    const existing = await this.repo.findOne({ where: { key: GLOBAL_KEY } });

    if (existing) {
      this.cache.set(GLOBAL_KEY, this.projectGlobal(existing));
      this.log.log('Global settings loaded from Postgres');
      return;
    }

    const seed: GlobalSettingsFields = {
      rateCacheTtlMs: TUNABLE_DEFAULTS.RATE_CACHE_TTL_MS,
      webhookMaxAttempts: TUNABLE_DEFAULTS.WEBHOOK_MAX_ATTEMPTS,
      webhookTimeoutMs: TUNABLE_DEFAULTS.WEBHOOK_TIMEOUT_MS,
      webhookDispatchIntervalMs: TUNABLE_DEFAULTS.WEBHOOK_DISPATCH_INTERVAL_MS,
      underpaymentToleranceCents: TUNABLE_DEFAULTS.UNDERPAYMENT_TOLERANCE_CENTS,
    };

    await this.repo
      .createQueryBuilder()
      .insert()
      .values({ key: GLOBAL_KEY, ...seed })
      .orIgnore()
      .execute();

    const doc = await this.repo.findOne({ where: { key: GLOBAL_KEY } });
    if (!doc) throw new Error('Global settings doc missing after upsert');
    this.cache.set(GLOBAL_KEY, this.projectGlobal(doc));
    this.log.log('Global settings seeded');
  }

  async load(chain: Chain): Promise<void> {
    const existing = await this.repo.findOne({ where: { key: chain } });

    if (existing) {
      this.cache.set(chain, this.project(existing));
      this.log.log(`Settings loaded from Postgres for ${chain}`);
      return;
    }

    const seed: SettingsFields = {
      ...this.getGlobal(),
      confirmationDepth: TUNABLE_DEFAULTS.CONFIRMATION_DEPTH,
      invoiceDefaultExpirySec: TUNABLE_DEFAULTS.INVOICE_DEFAULT_EXPIRY_SEC,
      scannerLockTtlMs: TUNABLE_DEFAULTS.SCANNER_LOCK_TTL_MS,
      syncedThresholdBlocks: TUNABLE_DEFAULTS.MONERO_SYNCED_THRESHOLD_BLOCKS,
    };

    await this.repo
      .createQueryBuilder()
      .insert()
      .values({ key: chain, ...seed })
      .orIgnore()
      .execute();

    const doc = await this.repo.findOne({ where: { key: chain } });
    if (!doc) throw new Error(`Settings doc missing for ${chain} after upsert`);
    this.cache.set(chain, this.project(doc));
    this.log.log(`Settings seeded for ${chain}`);
  }

  private projectGlobal(
    doc: Partial<GlobalSettingsFields>,
  ): GlobalSettingsFields {
    return {
      rateCacheTtlMs: doc.rateCacheTtlMs!,
      webhookMaxAttempts: doc.webhookMaxAttempts!,
      webhookTimeoutMs: doc.webhookTimeoutMs!,
      webhookDispatchIntervalMs: doc.webhookDispatchIntervalMs!,
      underpaymentToleranceCents:
        doc.underpaymentToleranceCents ??
        TUNABLE_DEFAULTS.UNDERPAYMENT_TOLERANCE_CENTS,
    };
  }

  private project(doc: Partial<SettingsFields>): SettingsFields {
    return {
      ...this.projectGlobal(doc),
      confirmationDepth: doc.confirmationDepth!,
      invoiceDefaultExpirySec: doc.invoiceDefaultExpirySec!,
      scannerLockTtlMs: doc.scannerLockTtlMs!,
      syncedThresholdBlocks: doc.syncedThresholdBlocks!,
    };
  }

  get<K extends keyof SettingsFields>(chain: Chain, key: K): SettingsFields[K] {
    return this.getAll(chain)[key];
  }

  getGlobal(): GlobalSettingsFields {
    const v = this.cache.get(GLOBAL_KEY);
    if (!v) throw new Error('Global settings not loaded');
    return { ...v };
  }

  // A chain row holds a copy of the global fields from when it was seeded,
  // which never follows updateGlobal, so the live global values win.
  getAll(chain: Chain): SettingsFields {
    const v = this.cache.get(chain) as SettingsFields | undefined;
    if (!v) throw new Error(`Settings not loaded for chain: ${chain}`);
    return { ...v, ...this.getGlobal() };
  }

  async updateGlobal(
    partial: Partial<GlobalSettingsFields>,
  ): Promise<GlobalSettingsFields> {
    const set: Partial<GlobalSettingsFields> = {};
    for (const [k, v] of Object.entries(partial)) {
      if (v !== undefined) (set as Record<string, unknown>)[k] = v;
    }
    if (Object.keys(set).length === 0) return this.getGlobal();

    const result = await this.repo.update({ key: GLOBAL_KEY }, set);
    if (!result.affected) throw new Error('Global settings document missing');

    const updated = await this.repo.findOne({ where: { key: GLOBAL_KEY } });
    if (!updated) throw new Error('Global settings document missing');
    this.cache.set(GLOBAL_KEY, this.projectGlobal(updated));
    return this.getGlobal();
  }

  async update(
    chain: Chain,
    partial: Partial<SettingsFields>,
  ): Promise<SettingsFields> {
    const set: Partial<SettingsFields> = {};
    for (const [k, v] of Object.entries(partial)) {
      if (v !== undefined) (set as Record<string, unknown>)[k] = v;
    }
    if (Object.keys(set).length === 0) return this.getAll(chain);

    const result = await this.repo.update({ key: chain }, set);
    if (!result.affected)
      throw new Error(`Settings document missing for chain ${chain}`);

    const updated = await this.repo.findOne({ where: { key: chain } });
    if (!updated)
      throw new Error(`Settings document missing for chain ${chain}`);
    this.cache.set(chain, this.project(updated));
    return this.getAll(chain);
  }
}
