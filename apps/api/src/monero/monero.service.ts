import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type { MoneroWalletFull } from 'monero-ts';
import { MONERO_WALLET } from './monero.constants';
import { SettingsService } from '../settings/settings.service';
import { MoneroWalletListener } from 'monero-ts';
import { WalletInfoResponseDto } from '../admin/dto/wallet-info.dto';
import { Chain } from '@mintit/types';

export interface WalletInfo {
  primaryAddress: string;
  viewKey: string;
  restoreHeight: number;
  walletHeight: number;
  daemonHeight: number;
  synced: boolean;
}

/**
 * Logs wallet sync progress. monero-ts fires onSyncProgress for every batch of
 * blocks, so output is throttled to one line per `intervalMs`, plus the final
 * 100% line.
 */
class SyncProgressListener extends MoneroWalletListener {
  private lastEmit = 0;

  constructor(
    private readonly emit: (msg: string) => void,
    private readonly intervalMs = 5_000,
  ) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onSyncProgress(
    height: number,
    startHeight: number,
    endHeight: number,
    percentDone: number,
    message: string,
  ): Promise<void> {
    const now = Date.now();
    const done = percentDone >= 1;
    if (!done && now - this.lastEmit < this.intervalMs) return;
    this.lastEmit = now;
    this.emit(
      `Sync ${(percentDone * 100).toFixed(1)}% (height ${height} / ${endHeight}, from ${startHeight}, ${endHeight - height} behind)${message ? ` — ${message}` : ''}`,
    );
  }
}

@Injectable()
export class MoneroService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MoneroService.name);
  private readonly accountIndex = 0;

  constructor(
    @Inject(MONERO_WALLET) private readonly wallet: MoneroWalletFull,
    private readonly settings: SettingsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const primary = await this.wallet.getPrimaryAddress();
    this.logger.log(`Wallet loaded. Primary address: ${primary}`);

    // Stays attached for the wallet's lifetime, so the scanner's per-tick
    // syncs (including the long first catch-up) log their progress.
    await this.wallet.addListener(
      new SyncProgressListener((m) => this.logger.debug(m)),
    );
  }

  getClient(): MoneroWalletFull {
    return this.wallet;
  }

  async createSubaddress(
    label?: string,
  ): Promise<{ index: number; address: string }> {
    const sub = await this.wallet.createSubaddress(this.accountIndex, label);
    return { index: sub.getIndex(), address: sub.getAddress() };
  }

  async getSubaddress(index: number): Promise<string> {
    const sub = await this.wallet.getSubaddress(this.accountIndex, index);
    return sub.getAddress();
  }

  async getViewKey(): Promise<string> {
    return this.wallet.getPrivateViewKey();
  }

  async getPrimaryAddress(): Promise<string> {
    return this.wallet.getPrimaryAddress();
  }

  async getRestoreHeight(): Promise<number> {
    return this.wallet.getRestoreHeight();
  }

  async getHeight(): Promise<number> {
    return this.wallet.getHeight();
  }

  async getDaemonHeight(): Promise<number> {
    return this.wallet.getDaemonHeight();
  }

  async isSynced(): Promise<boolean> {
    const threshold = this.settings.get(Chain.Xmr, 'syncedThresholdBlocks');
    const [walletHeight, daemonHeight] = await Promise.all([
      this.wallet.getHeight(),
      this.wallet.getDaemonHeight(),
    ]);
    return daemonHeight - walletHeight <= threshold;
  }

  async getWalletInfo(): Promise<WalletInfoResponseDto> {
    const [primaryAddress, viewKey, restoreHeight, walletHeight, daemonHeight] =
      await Promise.all([
        this.wallet.getPrimaryAddress(),
        this.wallet.getPrivateViewKey(),
        this.wallet.getRestoreHeight(),
        this.wallet.getHeight(),
        this.wallet.getDaemonHeight(),
      ]);
    const threshold = this.settings.get(Chain.Xmr, 'syncedThresholdBlocks');
    return {
      chain: Chain.Xmr,
      primaryAddress,
      viewKey,
      restoreHeight,
      walletHeight,
      daemonHeight,
      synced: daemonHeight - walletHeight <= threshold,
    };
  }

  async sync(): Promise<void> {
    await this.wallet.sync();
  }
}
