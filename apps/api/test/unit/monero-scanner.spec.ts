import { Asset, Chain, InvoiceStatus } from '@mintit/types';
import { MoneroScannerService } from '../../src/monero/monero-scanner.service';
import { WebhookEvent } from '../../src/webhooks/schemas/webhook-delivery.entity';
import { MemoryRepo } from './helpers/memory-repo';

// Keep monero-ts (and its wasm) out of unit tests; the scanner only needs a
// wallet that answers getTransfers, which the fake below provides.
jest.mock('../../src/monero/monero.service', () => ({
  MoneroService: class {},
}));
jest.mock('../../src/webhooks/webhooks.service', () => ({
  WebhooksService: class {},
}));

const XMR = 10n ** 12n;
const USD_PER_XMR = 200;
const WEBHOOK_URL = 'https://merchant.example/hook';

interface FakeTransfer {
  hash: string;
  sub: number;
  amount: bigint;
  confs: number;
  pool?: boolean;
}

function toMoneroTransfer(t: FakeTransfer) {
  return {
    getIsIncoming: () => true,
    getSubaddressIndex: () => t.sub,
    getAmount: () => t.amount,
    getTx: () => ({
      getHash: () => t.hash,
      getIsConfirmed: () => !t.pool,
      getIsLocked: () => t.confs < 10,
      getNumConfirmations: () => (t.pool ? 0 : t.confs),
      getHeight: () => (t.pool ? undefined : 3_000_000),
    }),
  };
}

function setup(opts: { toleranceCents?: number } = {}) {
  const invoices = new MemoryRepo<Record<string, any>>();
  const payments = new MemoryRepo<Record<string, any>>([
    'invoiceId',
    'txHash',
    'addressIndex',
  ]);
  let transfers: FakeTransfer[] = [];

  const wallet = {
    getTransfers: jest.fn(
      async (q: { subaddressIndices: number[]; txQuery?: unknown }) =>
        transfers
          .filter((t) => Boolean(t.pool) === Boolean(q.txQuery))
          .filter((t) => q.subaddressIndices.includes(t.sub))
          .map(toMoneroTransfer),
    ),
  };
  const monero = { sync: jest.fn(async () => {}), getClient: () => wallet };
  const lock = {
    acquire: jest.fn(async () => true),
    release: jest.fn(async () => {}),
  };
  const webhooks = { enqueue: jest.fn(async () => {}) };
  const global = { underpaymentToleranceCents: opts.toleranceCents ?? 0 };
  const settings = {
    get: jest.fn(() => 30_000),
    getGlobal: jest.fn(() => ({ ...global })),
  };

  const scanner = new MoneroScannerService(
    invoices as never,
    payments as never,
    monero as never,
    lock as never,
    webhooks as never,
    settings as never,
  );

  const addInvoice = (over: Record<string, unknown> = {}) => {
    const inv = {
      id: `inv-${invoices.rows.length + 1}`,
      chain: Chain.Xmr,
      asset: Asset.Xmr,
      assetDecimals: 12,
      address: 'sub-address',
      addressIndex: invoices.rows.length + 1,
      amountAtomic: XMR.toString(), // 1 XMR = $200
      amountFiat: USD_PER_XMR,
      rate: 1 / USD_PER_XMR,
      status: InvoiceStatus.Pending,
      confirmationsRequired: 2,
      confirmations: 0,
      receivedAtomic: '0',
      expiresAt: new Date(Date.now() + 3_600_000),
      webhookUrl: WEBHOOK_URL,
      ...over,
    };
    invoices.rows.push(inv);
    return inv;
  };

  return {
    scanner,
    invoices,
    payments,
    monero,
    lock,
    webhooks,
    settings,
    global,
    addInvoice,
    setTransfers: (t: FakeTransfer[]) => (transfers = t),
    get: (id: string) => invoices.rows.find((r) => r.id === id)!,
    events: () =>
      webhooks.enqueue.mock.calls.map((c: unknown[]) => c[2] as WebhookEvent),
  };
}

describe('MoneroScannerService', () => {
  describe('payment lifecycle', () => {
    it('leaves an invoice pending when nothing has arrived', async () => {
      const t = setup();
      const inv = t.addInvoice();
      await t.scanner.tick();
      expect(t.get(inv.id).status).toBe(InvoiceStatus.Pending);
      expect(t.webhooks.enqueue).not.toHaveBeenCalled();
    });

    it('marks an invoice seen when a payment is in the pool', async () => {
      const t = setup();
      const inv = t.addInvoice();
      t.setTransfers([
        {
          hash: 'tx1',
          sub: inv.addressIndex,
          amount: XMR,
          confs: 0,
          pool: true,
        },
      ]);

      await t.scanner.tick();

      const after = t.get(inv.id);
      expect(after.status).toBe(InvoiceStatus.Seen);
      expect(after.firstSeenAt).toBeInstanceOf(Date);
      expect(after.receivedAtomic).toBe(XMR.toString());
      expect(t.events()).toEqual([WebhookEvent.InvoiceSeen]);
      expect(t.payments.rows).toHaveLength(1);
    });

    it('stays seen until the payment reaches the required depth', async () => {
      const t = setup();
      const inv = t.addInvoice({ confirmationsRequired: 3 });
      t.setTransfers([
        { hash: 'tx1', sub: inv.addressIndex, amount: XMR, confs: 2 },
      ]);

      await t.scanner.tick();

      expect(t.get(inv.id).status).toBe(InvoiceStatus.Seen);
      expect(t.get(inv.id).confirmations).toBe(2);
    });

    it('confirms a full payment at the required depth', async () => {
      const t = setup();
      const inv = t.addInvoice();
      t.setTransfers([
        {
          hash: 'tx1',
          sub: inv.addressIndex,
          amount: XMR,
          confs: 0,
          pool: true,
        },
      ]);
      await t.scanner.tick();

      t.setTransfers([
        { hash: 'tx1', sub: inv.addressIndex, amount: XMR, confs: 2 },
      ]);
      await t.scanner.tick();

      const after = t.get(inv.id);
      expect(after.status).toBe(InvoiceStatus.Confirmed);
      expect(after.paidAt).toBeInstanceOf(Date);
      expect(t.events()).toEqual([
        WebhookEvent.InvoiceSeen,
        WebhookEvent.InvoiceConfirmed,
      ]);
      // Same tx seen twice is one payment row, updated in place.
      expect(t.payments.rows).toHaveLength(1);
      expect(t.payments.rows[0].confirmations).toBe(2);
      expect(t.payments.rows[0].confirmedAt).toBeInstanceOf(Date);
    });

    it('accepts an overpayment as confirmed', async () => {
      const t = setup();
      const inv = t.addInvoice();
      t.setTransfers([
        { hash: 'tx1', sub: inv.addressIndex, amount: 2n * XMR, confs: 5 },
      ]);
      await t.scanner.tick();
      expect(t.get(inv.id).status).toBe(InvoiceStatus.Confirmed);
    });

    // Pins current behaviour: a payment first noticed already deep enough
    // skips "seen", so merchants get invoice.confirmed without invoice.seen.
    it('goes straight from pending to confirmed with a single webhook', async () => {
      const t = setup();
      const inv = t.addInvoice();
      t.setTransfers([
        { hash: 'tx1', sub: inv.addressIndex, amount: XMR, confs: 10 },
      ]);

      await t.scanner.tick();

      expect(t.get(inv.id).status).toBe(InvoiceStatus.Confirmed);
      expect(t.get(inv.id).firstSeenAt).toBeInstanceOf(Date);
      expect(t.events()).toEqual([WebhookEvent.InvoiceConfirmed]);
    });

    it('marks a short payment underpaid once it is confirmed', async () => {
      const t = setup();
      const inv = t.addInvoice();
      t.setTransfers([
        { hash: 'tx1', sub: inv.addressIndex, amount: XMR / 2n, confs: 2 },
      ]);

      await t.scanner.tick();

      expect(t.get(inv.id).status).toBe(InvoiceStatus.Underpaid);
      expect(t.get(inv.id).receivedAtomic).toBe((XMR / 2n).toString());
      expect(t.events()).toEqual([WebhookEvent.InvoiceUnderpaid]);
    });

    it('confirms an underpaid invoice once it is topped up', async () => {
      const t = setup();
      const inv = t.addInvoice();
      const first = {
        hash: 'tx1',
        sub: inv.addressIndex,
        amount: XMR / 2n,
        confs: 2,
      };
      t.setTransfers([first]);
      await t.scanner.tick();

      t.setTransfers([
        { ...first, confs: 4 },
        { hash: 'tx2', sub: inv.addressIndex, amount: XMR / 2n, confs: 2 },
      ]);
      await t.scanner.tick();

      expect(t.get(inv.id).status).toBe(InvoiceStatus.Confirmed);
      expect(t.get(inv.id).receivedAtomic).toBe(XMR.toString());
      expect(t.events()).toEqual([
        WebhookEvent.InvoiceUnderpaid,
        WebhookEvent.InvoiceConfirmed,
      ]);
    });

    it('waits for the shallowest of several payments', async () => {
      const t = setup();
      const inv = t.addInvoice({ confirmationsRequired: 3 });
      t.setTransfers([
        { hash: 'tx1', sub: inv.addressIndex, amount: XMR / 2n, confs: 10 },
        { hash: 'tx2', sub: inv.addressIndex, amount: XMR / 2n, confs: 1 },
      ]);

      await t.scanner.tick();

      expect(t.get(inv.id).status).toBe(InvoiceStatus.Seen);
      expect(t.get(inv.id).confirmations).toBe(1);
      expect(t.get(inv.id).receivedAtomic).toBe(XMR.toString());
    });

    it('does not re-fire webhooks or duplicate payments on later ticks', async () => {
      const t = setup();
      const inv = t.addInvoice();
      t.setTransfers([
        { hash: 'tx1', sub: inv.addressIndex, amount: XMR, confs: 2 },
      ]);

      await t.scanner.tick();
      await t.scanner.tick();
      await t.scanner.tick();

      expect(t.events()).toEqual([WebhookEvent.InvoiceConfirmed]);
      expect(t.payments.rows).toHaveLength(1);
    });

    it('only credits transfers to the invoice’s own subaddress', async () => {
      const t = setup();
      const a = t.addInvoice();
      const b = t.addInvoice();
      t.setTransfers([
        { hash: 'tx1', sub: b.addressIndex, amount: XMR, confs: 2 },
      ]);

      await t.scanner.tick();

      expect(t.get(a.id).status).toBe(InvoiceStatus.Pending);
      expect(t.get(b.id).status).toBe(InvoiceStatus.Confirmed);
    });

    it('updates state without webhooks when the invoice has no webhook URL', async () => {
      const t = setup();
      const inv = t.addInvoice({ webhookUrl: undefined });
      t.setTransfers([
        { hash: 'tx1', sub: inv.addressIndex, amount: XMR, confs: 2 },
      ]);

      await t.scanner.tick();

      expect(t.get(inv.id).status).toBe(InvoiceStatus.Confirmed);
      expect(t.webhooks.enqueue).not.toHaveBeenCalled();
    });

    it('ignores a duplicate payment insert from a concurrent scanner', async () => {
      const t = setup();
      const inv = t.addInvoice();
      t.payments.rows.push({
        chain: Chain.Xmr,
        invoiceId: inv.id,
        txHash: 'tx1',
        addressIndex: inv.addressIndex,
        amountAtomic: XMR.toString(),
        confirmations: 2,
      });
      // The scanner's lookup misses the row another instance just wrote.
      t.payments.find.mockResolvedValueOnce([]);
      t.setTransfers([
        { hash: 'tx1', sub: inv.addressIndex, amount: XMR, confs: 2 },
      ]);

      await t.scanner.tick();

      expect(t.payments.rows).toHaveLength(1);
      expect(t.get(inv.id).status).toBe(InvoiceStatus.Confirmed);
    });
  });

  describe('underpayment tolerance', () => {
    // $1 at $200/XMR = 0.005 XMR.
    const ALLOWANCE = XMR / 200n;

    it('confirms a payment short by less than the tolerance', async () => {
      const t = setup({ toleranceCents: 100 });
      const inv = t.addInvoice();
      t.setTransfers([
        {
          hash: 'tx1',
          sub: inv.addressIndex,
          amount: XMR - ALLOWANCE,
          confs: 2,
        },
      ]);

      await t.scanner.tick();

      expect(t.get(inv.id).status).toBe(InvoiceStatus.Confirmed);
      expect(t.get(inv.id).receivedAtomic).toBe((XMR - ALLOWANCE).toString());
    });

    it('marks a payment short by more than the tolerance underpaid', async () => {
      const t = setup({ toleranceCents: 100 });
      const inv = t.addInvoice();
      t.setTransfers([
        {
          hash: 'tx1',
          sub: inv.addressIndex,
          amount: XMR - ALLOWANCE - 1n,
          confs: 2,
        },
      ]);

      await t.scanner.tick();

      expect(t.get(inv.id).status).toBe(InvoiceStatus.Underpaid);
    });

    it('settles a stuck underpaid invoice when the tolerance is raised', async () => {
      const t = setup();
      const inv = t.addInvoice();
      t.setTransfers([
        {
          hash: 'tx1',
          sub: inv.addressIndex,
          amount: XMR - ALLOWANCE,
          confs: 2,
        },
      ]);
      await t.scanner.tick();
      expect(t.get(inv.id).status).toBe(InvoiceStatus.Underpaid);

      t.global.underpaymentToleranceCents = 100;
      await t.scanner.tick();

      expect(t.get(inv.id).status).toBe(InvoiceStatus.Confirmed);
      expect(t.events()).toEqual([
        WebhookEvent.InvoiceUnderpaid,
        WebhookEvent.InvoiceConfirmed,
      ]);
    });

    it('never forgives more than 10% of a small invoice', async () => {
      // $5 tolerance on a $1 invoice: only $0.10 may be missing.
      const t = setup({ toleranceCents: 500 });
      const owed = XMR / 200n; // $1
      const inv = t.addInvoice({
        amountAtomic: owed.toString(),
        amountFiat: 1,
      });
      t.setTransfers([
        { hash: 'tx1', sub: inv.addressIndex, amount: owed / 2n, confs: 2 },
      ]);

      await t.scanner.tick();

      expect(t.get(inv.id).status).toBe(InvoiceStatus.Underpaid);
    });
  });

  describe('expiry', () => {
    it('expires a pending invoice past its expiry time', async () => {
      const t = setup();
      const inv = t.addInvoice({ expiresAt: new Date(Date.now() - 1000) });

      await t.scanner.tick();

      expect(t.get(inv.id).status).toBe(InvoiceStatus.Expired);
      expect(t.events()).toEqual([WebhookEvent.InvoiceExpired]);
    });

    it('does not expire a pending invoice before its expiry time', async () => {
      const t = setup();
      const inv = t.addInvoice();
      await t.scanner.tick();
      expect(t.get(inv.id).status).toBe(InvoiceStatus.Pending);
    });

    // Pins current behaviour: once a payment is seen the expiry timer stops,
    // even if that payment never confirms.
    it('does not expire an invoice that has seen a payment', async () => {
      const t = setup();
      const inv = t.addInvoice({
        status: InvoiceStatus.Seen,
        expiresAt: new Date(Date.now() - 1000),
      });

      await t.scanner.tick();

      expect(t.get(inv.id).status).toBe(InvoiceStatus.Seen);
    });

    it('fires the expired webhook only for the tick that expired it', async () => {
      const t = setup();
      t.addInvoice({ expiresAt: new Date(Date.now() - 1000) });

      await t.scanner.tick();
      await t.scanner.tick();

      expect(t.events()).toEqual([WebhookEvent.InvoiceExpired]);
    });
  });

  describe('tick', () => {
    it('does nothing when another instance holds the lock', async () => {
      const t = setup();
      t.lock.acquire.mockResolvedValueOnce(false);

      await t.scanner.tick();

      expect(t.monero.sync).not.toHaveBeenCalled();
      expect(t.lock.release).not.toHaveBeenCalled();
    });

    it('releases the lock and swallows the error when a tick fails', async () => {
      const t = setup();
      t.monero.sync.mockRejectedValueOnce(new Error('daemon down'));

      await expect(t.scanner.tick()).resolves.toBeUndefined();

      expect(t.lock.release).toHaveBeenCalledTimes(1);
    });

    it('skips a tick while the previous one is still running', async () => {
      const t = setup();
      let finish!: () => void;
      t.monero.sync.mockImplementationOnce(
        () => new Promise<void>((r) => (finish = r)),
      );

      const first = t.scanner.tick();
      await t.scanner.tick();
      finish();
      await first;

      expect(t.lock.acquire).toHaveBeenCalledTimes(1);
    });
  });
});
