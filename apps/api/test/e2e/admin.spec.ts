import { api, createInvoice, login, UNKNOWN_UUID } from './helpers';

describe('Admin API', () => {
  let cookie: string;
  let invoice: Record<string, any>;
  const get = (url: string, params?: Record<string, unknown>) =>
    api.get(url, { params, headers: { Cookie: cookie } });

  beforeAll(async () => {
    [cookie, invoice] = await Promise.all([login(), createInvoice()]);
  });

  it.each([
    '/admin/wallet',
    '/admin/stats',
    '/admin/invoices',
    '/admin/settings/global',
    '/admin/settings?chain=xmr',
    '/admin/invoices/defaults',
    '/admin/users',
  ])('rejects %s without a session', async (url) => {
    expect((await api.get(url)).status).toBe(401);
  });

  describe('invoices', () => {
    it('finds an invoice by publicId', async () => {
      const { status, data } = await get('/admin/invoices', {
        publicId: invoice.publicId,
      });
      expect(status).toBe(200);
      expect(data.total).toBe(1);
      expect(data.data[0].id).toBe(invoice.id);
    });

    it('pages the list', async () => {
      const { status, data } = await get('/admin/invoices', {
        limit: 1,
        page: 1,
      });
      expect(status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.total).toBeGreaterThanOrEqual(1);
    });

    it('filters by status', async () => {
      const { data } = await get('/admin/invoices', {
        status: 'pending',
        limit: 50,
      });
      expect(
        data.data.every((i: { status: string }) => i.status === 'pending'),
      ).toBe(true);
    });

    it('filters by several statuses', async () => {
      const { status, data } = await get('/admin/invoices', {
        status: 'pending,confirmed',
        limit: 50,
      });
      expect(status).toBe(200);
      expect(
        data.data.every((i: { status: string }) =>
          ['pending', 'confirmed'].includes(i.status),
        ),
      ).toBe(true);
    });

    it.each([
      { page: 0 },
      { limit: 0 },
      { status: 'nope' },
      { status: 'pending,nope' },
      { publicId: 'not-a-uuid' },
    ])('rejects query %p', async (params) => {
      expect((await get('/admin/invoices', params)).status).toBe(400);
    });

    it('gets an invoice by publicId', async () => {
      const { status, data } = await get(`/admin/invoices/${invoice.publicId}`);
      expect(status).toBe(200);
      expect(data.id).toBe(invoice.id);
    });

    it('404s on an unknown publicId', async () => {
      expect((await get(`/admin/invoices/${UNKNOWN_UUID}`)).status).toBe(404);
    });
  });

  describe('wallet', () => {
    it('reports the view-only wallet and sync state', async () => {
      const { status, data } = await get('/admin/wallet');
      expect(status).toBe(200);
      expect(data.chain).toBe('xmr');
      expect(typeof data.primaryAddress).toBe('string');
      expect(data.viewKey).toMatch(/^[0-9a-f]{64}$/);
      expect(typeof data.synced).toBe('boolean');
      expect(data.daemonHeight).toBeGreaterThanOrEqual(data.walletHeight - 1);
    });

    it('returns stats', async () => {
      expect((await get('/admin/stats')).status).toBe(200);
    });
  });

  // Only rejected writes and a same-value write, so the instance's settings
  // are left as they were.
  describe('settings', () => {
    it('returns global settings including the underpayment tolerance', async () => {
      const { status, data } = await get('/admin/settings/global');
      expect(status).toBe(200);
      expect(Number.isInteger(data.underpaymentToleranceCents)).toBe(true);
      expect(data.underpaymentToleranceCents).toBeGreaterThanOrEqual(0);
    });

    it('returns chain settings', async () => {
      const { status, data } = await get('/admin/settings', { chain: 'xmr' });
      expect(status).toBe(200);
      expect(data.confirmationDepth).toBeGreaterThanOrEqual(1);
    });

    it.each([
      { underpaymentToleranceCents: -1 },
      { underpaymentToleranceCents: 10_001 },
      { underpaymentToleranceCents: 1.5 },
      { webhookTimeoutMs: 10 },
      { unknownSetting: 1 },
    ])('rejects global update %p', async (body) => {
      const { status } = await api.put('/admin/settings/global', body, {
        headers: { Cookie: cookie },
      });
      expect(status).toBe(400);
    });

    it('accepts a same-value global update', async () => {
      const { data: before } = await get('/admin/settings/global');
      const { status, data } = await api.put(
        '/admin/settings/global',
        { underpaymentToleranceCents: before.underpaymentToleranceCents },
        { headers: { Cookie: cookie } },
      );
      expect(status).toBe(200);
      expect(data).toEqual(before);
    });
  });
});
