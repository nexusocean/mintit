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
});
