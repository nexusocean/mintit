import BigNumber from 'bignumber.js';
import { Asset, Chain, InvoiceStatus } from '@mintit/types';
import { ViewsService } from '../../src/views/views.service';

const PUBLIC_ID = '0b8f3a5c-1d2e-4f60-8a9b-0c1d2e3f4a5b';

function invoice(over: Record<string, unknown> = {}) {
  return {
    publicId: PUBLIC_ID,
    chain: Chain.Xmr,
    asset: Asset.Xmr,
    assetDecimals: 12,
    address: '8BxSubaddress',
    amountAtomic: '123456789012',
    amountFiat: 24.6913578,
    fiatCurrency: 'USD',
    rate: 0.005,
    status: InvoiceStatus.Pending,
    confirmations: 0,
    confirmationsRequired: 2,
    receivedAtomic: '0',
    expiresAt: new Date('2026-03-05T14:07:00Z'),
    memo: 'Order 1',
    ...over,
  };
}

function setup(row: unknown) {
  const repo = { findOne: jest.fn(async () => row) };
  return { service: new ViewsService(repo as never), repo };
}

describe('ViewsService', () => {
  describe('getInvoice', () => {
    it('returns null for an unknown invoice', async () => {
      expect(await setup(null).service.getInvoice(PUBLIC_ID)).toBeNull();
    });

    it('formats amounts, rate and expiry for the checkout page', async () => {
      const res = await setup(invoice()).service.getInvoice(PUBLIC_ID);
      expect(res).toMatchObject({
        amountFormatted: '0.123457',
        amountFiat: '24.69',
        fiatPerAsset: '200.00',
        expiresAt: 'Mar 5, 2026, 2:07 PM UTC',
        expiresAtIso: '2026-03-05T14:07:00.000Z',
        memo: 'Order 1',
      });
    });

    // The payer copies this number, so it must never be below what is owed,
    // and rounding up to 6 decimals adds less than 0.000001 XMR.
    it('never displays less than the amount owed', async () => {
      const step = new BigNumber('0.000001');
      for (let i = 1; i <= 5000; i++) {
        const atomic = (BigInt(i) * 997_331n).toString();
        const res = await setup(
          invoice({ amountAtomic: atomic }),
        ).service.getInvoice(PUBLIC_ID);
        const owed = new BigNumber(atomic).shiftedBy(-12);
        const shown = new BigNumber(res!.amountFormatted);
        expect(shown.gte(owed)).toBe(true);
        expect(shown.minus(owed).lte(step)).toBe(true);
      }
    });
  });

  describe('getStatus', () => {
    it('returns only the polling fields', async () => {
      const res = await setup(invoice()).service.getStatus(PUBLIC_ID);
      expect(res).toEqual({
        status: InvoiceStatus.Pending,
        confirmations: 0,
        confirmationsRequired: 2,
        receivedAtomic: '0',
      });
    });

    it('returns null for an unknown invoice', async () => {
      expect(await setup(null).service.getStatus(PUBLIC_ID)).toBeNull();
    });
  });
});
