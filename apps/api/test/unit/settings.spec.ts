import { Chain } from '@mintit/types';
import { SettingsService } from '../../src/settings/settings.service';
import { MemoryRepo } from './helpers/memory-repo';

const GLOBAL = {
  rateCacheTtlMs: 45_000,
  webhookMaxAttempts: 8,
  webhookTimeoutMs: 10_000,
  webhookDispatchIntervalMs: 5_000,
  underpaymentToleranceCents: 10,
};

// Rows already in Postgres, so onModuleInit loads rather than seeds.
async function setup() {
  const repo = new MemoryRepo<Record<string, unknown>>();
  repo.rows.push(
    { key: 'global', ...GLOBAL },
    {
      key: Chain.Xmr,
      // The copy of the global fields taken when the chain row was seeded.
      ...GLOBAL,
      confirmationDepth: 1,
      invoiceDefaultExpirySec: 7200,
      scannerLockTtlMs: 30_000,
      syncedThresholdBlocks: 2,
    },
  );
  const config = { get: jest.fn(() => [Chain.Xmr]) };
  const service = new SettingsService(repo as never, config as never);
  await service.onModuleInit();
  return { service, repo };
}

describe('SettingsService', () => {
  it('reflects a global update in chain settings', async () => {
    const { service } = await setup();
    await service.updateGlobal({
      webhookMaxAttempts: 3,
      underpaymentToleranceCents: 50,
    });

    expect(service.getAll(Chain.Xmr)).toMatchObject({
      webhookMaxAttempts: 3,
      underpaymentToleranceCents: 50,
      confirmationDepth: 1,
    });
    expect(service.get(Chain.Xmr, 'webhookMaxAttempts')).toBe(3);
  });

  it('keeps global values after a chain update', async () => {
    const { service } = await setup();
    await service.updateGlobal({ webhookTimeoutMs: 2_000 });
    const updated = await service.update(Chain.Xmr, { confirmationDepth: 10 });

    expect(updated.confirmationDepth).toBe(10);
    expect(updated.webhookTimeoutMs).toBe(2_000);
  });
});
