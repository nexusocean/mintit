import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Asset, Chain, InvoiceStatus } from '@mintit/types';
import { InvoicesService } from '../../src/invoices/invoices.service';
import { PriceService } from '../../src/price/price.service';

jest.mock('../../src/chains/chains.service', () => ({
  ChainsService: class {},
}));

const NOW = new Date('2026-01-01T00:00:00Z');

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
  const service = new InvoicesService(
    repo as never,
    price,
    chains as never,
    settings as never,
  );
  return { service, repo, price, resolveAddress };
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
  });

  describe('findById', () => {
    it('404s on a non-UUID id without querying', async () => {
      const t = setup();
      await expect(t.service.findById('not-a-uuid')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(t.repo.findOne).not.toHaveBeenCalled();
    });

    it('404s on an unknown id', async () => {
      const t = setup();
      t.repo.findOne.mockResolvedValue(null);
      await expect(
        t.service.findById('6f1c2a5e-8a4b-4c3d-9e2f-1a2b3c4d5e6f'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
