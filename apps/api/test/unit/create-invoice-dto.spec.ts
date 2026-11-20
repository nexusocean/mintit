import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInvoiceDto } from '../../src/invoices/dto/create-invoice.dto';

const errorsFor = async (body: Record<string, unknown>) =>
  (await validate(plainToInstance(CreateInvoiceDto, body))).flatMap((e) =>
    Object.values(e.constraints ?? {}),
  );

const ONE_OF = 'Exactly one of [fiatAmount, amountAtomic] must be provided';

describe('CreateInvoiceDto', () => {
  it('accepts a fiat amount', async () => {
    expect(await errorsFor({ chain: 'xmr', fiatAmount: 1 })).toEqual([]);
  });

  it('accepts an atomic amount', async () => {
    expect(await errorsFor({ chain: 'xmr', amountAtomic: '1000' })).toEqual([]);
  });

  it('rejects neither amount', async () => {
    expect(await errorsFor({ chain: 'xmr' })).toContain(ONE_OF);
  });

  it('rejects both amounts', async () => {
    expect(
      await errorsFor({ chain: 'xmr', fiatAmount: 1, amountAtomic: '1000' }),
    ).toContain(ONE_OF);
  });

  describe('publicId', () => {
    const UUID_ERROR = 'publicId must be a UUID';

    it('accepts a UUID v4', async () => {
      expect(
        await errorsFor({
          chain: 'xmr',
          fiatAmount: 1,
          publicId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        }),
      ).toEqual([]);
    });

    it('accepts it omitted or null', async () => {
      expect(await errorsFor({ chain: 'xmr', fiatAmount: 1 })).toEqual([]);
      expect(
        await errorsFor({ chain: 'xmr', fiatAmount: 1, publicId: null }),
      ).toEqual([]);
    });

    it('rejects a non-UUID', async () => {
      expect(
        await errorsFor({ chain: 'xmr', fiatAmount: 1, publicId: 'order-42' }),
      ).toContain(UUID_ERROR);
    });

    it('rejects a UUID that is not v4', async () => {
      expect(
        await errorsFor({
          chain: 'xmr',
          fiatAmount: 1,
          publicId: 'a8098c1a-f86e-11da-bd1a-00112444be1e', // v1
        }),
      ).toContain(UUID_ERROR);
    });
  });
});
