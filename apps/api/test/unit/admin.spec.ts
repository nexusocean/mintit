import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { In } from 'typeorm';
import { NotFoundException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { InvoiceStatus, UserScope } from '@mintit/types';
import { AdminController } from '../../src/admin/admin.controller';
import { AdminService } from '../../src/admin/admin.service';
import { ROLES_KEY } from '../../src/auth/roles.decorator';
import { InvoiceListQueryDto } from '../../src/admin/dto/invoice-list.dto';

jest.mock('../../src/chains/chains.service', () => ({
  ChainsService: class {},
}));

/** Runs a raw query string object through the same transform + validation as the ValidationPipe. */
function parse(query: Record<string, unknown>) {
  const dto = plainToInstance(InvoiceListQueryDto, query);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors: errors.map((e) => e.property) };
}

function setup() {
  const repo = { findAndCount: jest.fn(async () => [[], 0]) };
  const service = new AdminService(
    {} as never,
    repo as never,
    {} as never,
    {} as never,
  );
  const list = async (query: Record<string, unknown>) => {
    const { dto, errors } = parse(query);
    expect(errors).toEqual([]);
    await service.listInvoices(dto);
    return (
      repo.findAndCount.mock.calls[0] as unknown as [
        { where: Record<string, unknown>; order: Record<string, string> },
      ]
    )[0];
  };
  return { list };
}

const PUBLIC_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

describe('InvoiceListQueryDto', () => {
  it('accepts one status', () => {
    expect(parse({ status: 'pending' }).dto.status).toEqual(['pending']);
  });

  it('splits a comma-separated list and trims it', () => {
    expect(parse({ status: 'pending, confirmed,' }).dto.status).toEqual([
      'pending',
      'confirmed',
    ]);
  });

  it('accepts a repeated query param', () => {
    expect(parse({ status: ['seen', 'expired'] }).dto.status).toEqual([
      'seen',
      'expired',
    ]);
  });

  it('rejects an unknown status anywhere in the list', () => {
    expect(parse({ status: 'pending,nope' }).errors).toEqual(['status']);
  });

  it('defaults to newest first', () => {
    const { dto } = parse({});
    expect(dto.status).toBeUndefined();
    expect(dto).toMatchObject({ sort: 'createdAt', order: 'desc' });
  });

  it.each([{ sort: 'memo' }, { sort: 'id' }, { order: 'sideways' }])(
    'rejects %p',
    (query) => {
      expect(parse(query).errors).toHaveLength(1);
    },
  );
});

describe('AdminService.listInvoices', () => {
  it('filters by several statuses with IN', async () => {
    const { where } = await setup().list({ status: 'pending,seen' });
    expect(where.status).toEqual(
      In([InvoiceStatus.Pending, InvoiceStatus.Seen]),
    );
  });

  it('ignores filters when looking up a publicId', async () => {
    const publicId = '0b8f3a5c-1d2e-4f60-8a9b-0c1d2e3f4a5b';
    const { where } = await setup().list({
      publicId,
      status: 'pending',
      chain: 'xmr',
    });
    expect(where).toEqual({ publicId });
  });

  it('sorts newest first by default, with id as the last tiebreak', async () => {
    const { order } = await setup().list({});
    expect(order).toEqual({ createdAt: 'DESC', id: 'ASC' });
  });

  it.each([
    ['amount', 'amountFiat'],
    ['status', 'status'],
    ['expiresAt', 'expiresAt'],
    ['publicId', 'publicId'],
  ])('sorts by %s using the %s column', async (sort, column) => {
    const { order } = await setup().list({ sort, order: 'asc' });
    expect(order).toEqual({ [column]: 'ASC', createdAt: 'DESC', id: 'ASC' });
    // Key order is the SQL ORDER BY order.
    expect(Object.keys(order)).toEqual([column, 'createdAt', 'id']);
  });

  it('pages with skip and take', async () => {
    const repo = { findAndCount: jest.fn(async () => [[], 45]) };
    const service = new AdminService(
      {} as never,
      repo as never,
      {} as never,
      {} as never,
    );
    const res = await service.listInvoices(parse({ page: 3, limit: 20 }).dto);
    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
    expect(res).toMatchObject({ total: 45, page: 3, limit: 20 });
  });
});

describe('AdminService.getWebhookAttempts', () => {
  function setupWebhooks(invoice: { id: string; publicId: string } | null) {
    const invoiceRepo = { findOne: jest.fn(async () => invoice) };
    const webhooks = {
      getAttempts: jest.fn(async () => [{ id: 'del-1' }]),
    };
    const service = new AdminService(
      {} as never,
      invoiceRepo as never,
      {} as never,
      webhooks as never,
    );
    return { service, invoiceRepo, webhooks };
  }

  it('looks the invoice up by publicId and returns its deliveries', async () => {
    const t = setupWebhooks({ id: 'internal-id', publicId: PUBLIC_ID });

    await expect(t.service.getWebhookAttempts(PUBLIC_ID)).resolves.toEqual([
      { id: 'del-1' },
    ]);
    expect(t.invoiceRepo.findOne).toHaveBeenCalledWith({
      where: { publicId: PUBLIC_ID },
    });
    // Deliveries reference the internal id, never the public one.
    expect(t.webhooks.getAttempts).toHaveBeenCalledWith('internal-id');
  });

  it('404s when the invoice does not exist', async () => {
    const t = setupWebhooks(null);

    await expect(t.service.getWebhookAttempts(PUBLIC_ID)).rejects.toThrow(
      NotFoundException,
    );
    expect(t.webhooks.getAttempts).not.toHaveBeenCalled();
  });
});

describe('AdminController webhooks route', () => {
  const handler = AdminController.prototype.getWebhookAttempts;

  it('is GET invoices/:publicId/webhooks', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'invoices/:publicId/webhooks',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.GET,
    );
  });

  it('allows admins and managers', () => {
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserScope.ADMIN,
      UserScope.MANAGER,
    ]);
  });
});
