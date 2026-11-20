import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Asset, Chain, InvoiceStatus } from '@mintit/types';
import { InvoicesService } from '../../src/invoices/invoices.service';
import { PriceService } from '../../src/price/price.service';
import { WebhookEvent } from '../../src/webhooks/schemas/webhook-delivery.entity';

jest.mock('../../src/chains/chains.service', () => ({
  ChainsService: class {},
}));

const NOW = new Date('2026-01-01T00:00:00Z');
const INTERNAL_ID = '6f1c2a5e-8a4b-4c3d-9e2f-1a2b3c4d5e6f';
const PUBLIC_ID = '0b8f3a5c-1d2e-4f60-8a9b-0c1d2e3f4a5b';

/** A stored pending invoice, as the repository would return it. */
const stored = (over: Record<string, unknown> = {}) => ({
  id: INTERNAL_ID,
  publicId: PUBLIC_ID,
  chain: Chain.Xmr,
  asset: Asset.Xmr,
  assetDecimals: 12,
  address: '8BxSubaddress',
  addressIndex: 7,
  amountAtomic: '1000',
  amountFiat: 1,
  fiatCurrency: 'USD',
  rate: 0.005,
  rateLockedAt: NOW,
  expiresAt: new Date(NOW.getTime() + 3600_000),
  status: InvoiceStatus.Pending,
  confirmationsRequired: 2,
  confirmations: 0,
  receivedAtomic: '0',
  createdAt: NOW,
  ...over,
});

function setup() {
  const repo = {
    create: jest.fn((d) => d),
    save: jest.fn(async (d) => ({
      id: '6f1c2a5e-8a4b-4c3d-9e2f-1a2b3c4d5e6f',
      publicId: '0b8f3a5c-1d2e-4f60-8a9b-0c1d2e3f4a5b',
      status: InvoiceStatus.Pending,
      confirmations: 0,
      receivedAtomic: '0',
      createdAt: NOW,
      ...d,
    })),
    findOne: jest.fn(),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const quote = {
    fiatPerAsset: 200,
    assetPerFiat: 0.005,
    fiatCurrency: 'USD',
    fetchedAt: NOW,
    source: 'test',
  };
  // Real conversion maths, stubbed quote.
  const price = new PriceService([], {} as never);
  jest.spyOn(price, 'getQuote').mockResolvedValue(quote);

  const resolveAddress = jest.fn(async () => ({
    address: '8BxSubaddress',
    addressIndex: 7,
  }));
  const chains = { get: jest.fn(() => ({ resolveAddress })) };
  const settings = {
    get: jest.fn((_c: Chain, key: string) =>
      key === 'invoiceDefaultExpirySec' ? 7200 : 2,
    ),
  };
  const webhooks = { enqueue: jest.fn(async () => undefined) };
  const service = new InvoicesService(
    repo as never,
    price,
    chains as never,
    settings as never,
    webhooks as never,
  );
  return { service, repo, price, resolveAddress, webhooks };
}

describe('InvoicesService', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());

  describe('create', () => {
    it('converts a fiat amount at the locked rate', async () => {
      const t = setup();
      const res = await t.service.create({
        chain: Chain.Xmr,
        fiatAmount: 19.99,
      });

      expect(res).toMatchObject({
        chain: Chain.Xmr,
        asset: Asset.Xmr,
        assetDecimals: 12,
        amountAtomic: '99950000000',
        amountFiat: 19.99,
        fiatCurrency: 'USD',
        rate: 0.005,
        rateLockedAt: NOW.toISOString(),
        address: '8BxSubaddress',
        addressIndex: 7,
        status: InvoiceStatus.Pending,
      });
    });

    it('records the fiat value of an atomic amount', async () => {
      const t = setup();
      const res = await t.service.create({
        chain: Chain.Xmr,
        amountAtomic: '500000000000', // 0.5 XMR
      });
      expect(res.amountAtomic).toBe('500000000000');
      expect(res.amountFiat).toBe(100);
    });

    it('applies the default expiry and confirmation depth', async () => {
      const t = setup();
      const res = await t.service.create({ chain: Chain.Xmr, fiatAmount: 1 });
      expect(res.expiresAt).toBe(
        new Date(NOW.getTime() + 7200_000).toISOString(),
      );
      expect(res.confirmationsRequired).toBe(2);
    });

    it('honours expiry and confirmation overrides', async () => {
      const t = setup();
      const res = await t.service.create({
        chain: Chain.Xmr,
        fiatAmount: 1,
        expiresInSeconds: 600,
        confirmationsRequired: 10,
      });
      expect(res.expiresAt).toBe(
        new Date(NOW.getTime() + 600_000).toISOString(),
      );
      expect(res.confirmationsRequired).toBe(10);
    });

    it('passes webhook URL, metadata and memo through', async () => {
      const t = setup();
      const res = await t.service.create({
        chain: Chain.Xmr,
        fiatAmount: 1,
        webhookUrl: 'https://merchant.example/hook',
        metadata: { orderId: 'ORD-1' },
        memo: 'Order 1',
      });
      expect(res).toMatchObject({
        webhookUrl: 'https://merchant.example/hook',
        metadata: { orderId: 'ORD-1' },
        memo: 'Order 1',
      });
    });

    // Pins current behaviour. Swagger documents a 503 here; the service maps
    // a price failure to 400.
    it('rejects with 400 when the price feed is down', async () => {
      const t = setup();
      jest.spyOn(t.price, 'getQuote').mockRejectedValue(new Error('down'));
      await expect(
        t.service.create({ chain: Chain.Xmr, fiatAmount: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(t.resolveAddress).not.toHaveBeenCalled();
    });

    describe('with a caller-chosen publicId', () => {
      const KEY = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const UUID_V4 =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

      it('creates the invoice with that publicId on the first request', async () => {
        const t = setup();
        t.repo.findOne.mockResolvedValue(null);

        const res = await t.service.create({
          publicId: KEY,
          chain: Chain.Xmr,
          fiatAmount: 1,
        });

        expect(t.repo.findOne).toHaveBeenCalledWith({
          where: { publicId: KEY },
        });
        expect(t.repo.create).toHaveBeenCalledWith(
          expect.objectContaining({ publicId: KEY }),
        );
        expect(t.resolveAddress).toHaveBeenCalledTimes(1);
        expect(res.publicId).toBe(KEY);
      });

      it('returns the existing invoice on a retry without a new quote or subaddress', async () => {
        const t = setup();
        // Any status: a retry returns whatever the invoice has become.
        t.repo.findOne.mockResolvedValue(
          stored({ publicId: KEY, status: InvoiceStatus.Expired }),
        );

        const res = await t.service.create({
          publicId: KEY,
          chain: Chain.Xmr,
          fiatAmount: 1,
        });

        expect(res).toMatchObject({
          publicId: KEY,
          status: InvoiceStatus.Expired,
          address: '8BxSubaddress',
        });
        expect(t.price.getQuote).not.toHaveBeenCalled();
        expect(t.resolveAddress).not.toHaveBeenCalled();
        expect(t.repo.save).not.toHaveBeenCalled();
      });

      it('generates a publicId without a lookup when omitted', async () => {
        const t = setup();
        await t.service.create({ chain: Chain.Xmr, fiatAmount: 1 });

        expect(t.repo.findOne).not.toHaveBeenCalled();
        expect(t.repo.create).toHaveBeenCalledWith(
          expect.objectContaining({ publicId: expect.stringMatching(UUID_V4) }),
        );
      });

      it('generates a publicId without a lookup when null', async () => {
        const t = setup();
        await t.service.create({
          publicId: null as unknown as undefined,
          chain: Chain.Xmr,
          fiatAmount: 1,
        });

        expect(t.repo.findOne).not.toHaveBeenCalled();
        expect(t.repo.create).toHaveBeenCalledWith(
          expect.objectContaining({ publicId: expect.stringMatching(UUID_V4) }),
        );
      });

      it('rethrows a lookup failure instead of creating a second invoice', async () => {
        const t = setup();
        t.repo.findOne.mockRejectedValue(new Error('db down'));

        await expect(
          t.service.create({ publicId: KEY, chain: Chain.Xmr, fiatAmount: 1 }),
        ).rejects.toThrow('db down');
        expect(t.resolveAddress).not.toHaveBeenCalled();
        expect(t.repo.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('findByPublicId', () => {
    it('404s on a non-UUID id without querying', async () => {
      const t = setup();
      await expect(
        t.service.findByPublicId('not-a-uuid'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(t.repo.findOne).not.toHaveBeenCalled();
    });

    it('404s on an unknown id', async () => {
      const t = setup();
      t.repo.findOne.mockResolvedValue(null);
      await expect(t.service.findByPublicId(PUBLIC_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('looks the invoice up by publicId', async () => {
      const t = setup();
      t.repo.findOne.mockResolvedValue(stored());
      const res = await t.service.findByPublicId(PUBLIC_ID);
      expect(t.repo.findOne).toHaveBeenCalledWith({
        where: { publicId: PUBLIC_ID },
      });
      expect(res.publicId).toBe(PUBLIC_ID);
      expect(res).not.toHaveProperty('id');
    });
  });

  describe('cancel', () => {
    it('cancels only while pending and unexpired', async () => {
      const t = setup();
      t.repo.findOne.mockResolvedValue(stored());
      const res = await t.service.cancel(PUBLIC_ID);

      expect(res.status).toBe(InvoiceStatus.Cancelled);
      const [where, changes] = t.repo.update.mock.calls[0] as unknown as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(where).toMatchObject({
        id: INTERNAL_ID,
        status: InvoiceStatus.Pending,
      });
      expect(where.expiresAt).toBeDefined();
      expect(changes).toEqual({ status: InvoiceStatus.Cancelled });
    });

    it('409s when the invoice is no longer pending', async () => {
      const t = setup();
      t.repo.findOne.mockResolvedValue(stored({ status: InvoiceStatus.Seen }));
      t.repo.update.mockResolvedValue({ affected: 0 });
      await expect(t.service.cancel(PUBLIC_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(t.webhooks.enqueue).not.toHaveBeenCalled();
    });

    it('404s on an unknown invoice', async () => {
      const t = setup();
      t.repo.findOne.mockResolvedValue(null);
      await expect(t.service.cancel(PUBLIC_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(t.repo.update).not.toHaveBeenCalled();
    });

    it('sends invoice.cancelled with the publicId', async () => {
      const t = setup();
      t.repo.findOne.mockResolvedValue(
        stored({ webhookUrl: 'https://merchant.example/hook' }),
      );
      await t.service.cancel(PUBLIC_ID);
      expect(t.webhooks.enqueue).toHaveBeenCalledWith(
        INTERNAL_ID,
        'https://merchant.example/hook',
        WebhookEvent.InvoiceCancelled,
        expect.objectContaining({
          publicId: PUBLIC_ID,
          status: InvoiceStatus.Cancelled,
        }),
      );
    });

    it('sends no webhook without a webhook URL', async () => {
      const t = setup();
      t.repo.findOne.mockResolvedValue(stored());
      await t.service.cancel(PUBLIC_ID);
      expect(t.webhooks.enqueue).not.toHaveBeenCalled();
    });
  });
});
