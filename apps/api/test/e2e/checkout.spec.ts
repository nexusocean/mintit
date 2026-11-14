import { createInvoice, site, UNKNOWN_UUID } from './helpers';

// The hosted checkout page and the status endpoint it polls are public:
// anyone holding the publicId can load them, so they must not leak more
// than the payer needs.
describe('Hosted checkout', () => {
  let invoice: Record<string, any>;

  beforeAll(async () => {
    invoice = await createInvoice({ memo: 'e2e <b>checkout</b>' });
  });

  describe('GET /i/:publicId', () => {
    it('renders the payment page', async () => {
      const res = await site.get(`/i/${invoice.publicId}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.data).toContain(invoice.address);
      expect(res.data).toContain('data:image/png;base64'); // QR code
    });

    it('escapes the merchant memo', async () => {
      const { data } = await site.get(`/i/${invoice.publicId}`);
      expect(data).toContain('e2e &lt;b&gt;checkout&lt;/b&gt;');
      expect(data).not.toContain('<b>checkout</b>');
    });

    it('does not expose merchant-only fields', async () => {
      const { data } = await site.get(`/i/${invoice.publicId}`);
      expect(data).not.toContain(invoice.id);
      expect(data).not.toContain('"source":"e2e"');
    });

    it('rejects a malformed publicId', async () => {
      expect((await site.get('/i/not-a-uuid')).status).toBe(400);
    });

    it('404s on an unknown publicId', async () => {
      expect((await site.get(`/i/${UNKNOWN_UUID}`)).status).toBe(404);
    });

    it('is not reachable by the private invoice id', async () => {
      expect((await site.get(`/i/${invoice.id}`)).status).toBe(404);
    });
  });

  describe('GET /i/:publicId/status', () => {
    it('returns only the polling fields', async () => {
      const { status, data } = await site.get(`/i/${invoice.publicId}/status`);
      expect(status).toBe(200);
      expect(data).toEqual({
        status: 'pending',
        confirmations: 0,
        confirmationsRequired: invoice.confirmationsRequired,
        receivedAtomic: '0',
      });
    });

    it('404s on an unknown publicId', async () => {
      expect((await site.get(`/i/${UNKNOWN_UUID}/status`)).status).toBe(404);
    });
  });
});
