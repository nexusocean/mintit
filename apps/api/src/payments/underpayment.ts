import BigNumber from 'bignumber.js';

/** Tolerance never forgives more than this share of an invoice, so a large
 * setting can't let a payer settle a small invoice with dust. */
export const MAX_TOLERANCE_SHARE = 10n; // 1/10 = 10%

/**
 * Smallest received amount (atomic units) that still counts as paid in full.
 *
 * `toleranceCents` is a fiat amount, converted with the rate locked on the
 * invoice (`assetPerFiat`) so the result is fixed for the invoice's lifetime.
 * Rounds the allowance down, so it never exceeds the configured tolerance.
 */
export function minAcceptedAtomic(
  owedAtomic: bigint,
  toleranceCents: number,
  assetPerFiat: number,
  decimals: number,
): bigint {
  if (toleranceCents <= 0 || !(assetPerFiat > 0)) return owedAtomic;

  const allowance = BigInt(
    new BigNumber(toleranceCents)
      .dividedBy(100)
      .multipliedBy(assetPerFiat)
      .multipliedBy(new BigNumber(10).pow(decimals))
      .integerValue(BigNumber.ROUND_FLOOR)
      .toFixed(0),
  );
  const cap = owedAtomic / MAX_TOLERANCE_SHARE;

  return owedAtomic - (allowance < cap ? allowance : cap);
}
