import { minAcceptedAtomic } from '../../src/payments/underpayment';

const XMR = 10n ** 12n;
const RATE = 1 / 200; // XMR per USD at $200/XMR

describe('minAcceptedAtomic', () => {
  it('requires the full amount when tolerance is zero', () => {
    expect(minAcceptedAtomic(XMR, 0, RATE, 12)).toBe(XMR);
  });

  it('converts the fiat tolerance with the invoice rate', () => {
    // $1 at $200/XMR = 0.005 XMR
    expect(minAcceptedAtomic(XMR, 100, RATE, 12)).toBe(XMR - XMR / 200n);
  });

  it('caps the allowance at 10% of the invoice', () => {
    // $50 tolerance on a $200 invoice: only $20 may be missing.
    expect(minAcceptedAtomic(XMR, 5000, RATE, 12)).toBe(XMR - XMR / 10n);
  });

  it('rounds the allowance down to whole atomic units', () => {
    // 1 cent at 1/3 asset per fiat, 2 decimals = 0.333… atomic → 0
    expect(minAcceptedAtomic(1000n, 1, 1 / 3, 2)).toBe(1000n);
  });

  it('requires the full amount when the rate is unusable', () => {
    expect(minAcceptedAtomic(XMR, 100, 0, 12)).toBe(XMR);
    expect(minAcceptedAtomic(XMR, 100, NaN, 12)).toBe(XMR);
  });
});
