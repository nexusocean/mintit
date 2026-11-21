import { api, createInvoice, login, UNKNOWN_UUID, UUID_V4 } from './helpers';

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
    `/admin/invoices/${UNKNOWN_UUID}/webhooks`,
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
      expect(data.data[0].publicId).toBe(invoice.publicId);
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

    it('sorts by amount ascending', async () => {
      const { status, data } = await get('/admin/invoices', {
        sort: 'amount',
        order: 'asc',
        limit: 50,
      });
      expect(status).toBe(200);
      const amounts = data.data.map(
        (i: { amountFiat: number }) => i.amountFiat,
      );
      expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
    });

    it.each([
      { page: 0 },
      { sort: 'memo' },
      { order: 'sideways' },
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
      expect(data.publicId).toBe(invoice.publicId);
    });

    it('404s on an unknown publicId', async () => {
      expect((await get(`/admin/invoices/${UNKNOWN_UUID}`)).status).toBe(404);
    });

    describe('cancel', () => {
      const cancel = (publicId: string) =>
        api.post(`/admin/invoices/${publicId}/cancel`, null, {
          headers: { Cookie: cookie },
        });

      it('cancels a pending invoice once', async () => {
        const fresh = await createInvoice();
        const first = await cancel(fresh.publicId);
        expect(first.status).toBe(200);
        expect(first.data.status).toBe('cancelled');
        expect((await cancel(fresh.publicId)).status).toBe(409);
      });

      it('404s on an unknown publicId', async () => {
        expect((await cancel(UNKNOWN_UUID)).status).toBe(404);
      });

      it('rejects a malformed publicId', async () => {
        expect((await cancel('not-a-uuid')).status).toBe(400);
      });
    });

    describe('webhooks', () => {
      const webhooks = (publicId: string) =>
        get(`/admin/invoices/${publicId}/webhooks`);

      it('lists the delivery queued by a cancel', async () => {
        // Nothing listens on port 9: the send fails, but the row exists
        // either way, and that row is what this endpoint reports.
        const fresh = await createInvoice({
          webhookUrl: 'http://127.0.0.1:9/hook',
        });
        await api.post(`/admin/invoices/${fresh.publicId}/cancel`, null, {
          headers: { Cookie: cookie },
        });

        const { status, data } = await webhooks(fresh.publicId);
        expect(status).toBe(200);
        expect(data).toHaveLength(1);
        expect(data[0]).toMatchObject({
          id: expect.stringMatching(UUID_V4),
          event: 'invoice.cancelled',
          status: expect.stringMatching(/^(pending|dead_lettered)$/),
          attempts: expect.any(Number),
          nextAttemptAt: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });
        expect(data[0]).not.toHaveProperty('payload');
      });

      it('returns an empty list for an invoice without a webhook URL', async () => {
        const { status, data } = await webhooks(invoice.publicId);
        expect(status).toBe(200);
        expect(data).toEqual([]);
      });

      it('404s on an unknown publicId', async () => {
        expect((await webhooks(UNKNOWN_UUID)).status).toBe(404);
      });

      it('rejects a malformed publicId', async () => {
        expect((await webhooks('not-a-uuid')).status).toBe(400);
      });
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
