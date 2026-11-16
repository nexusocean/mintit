import { api, apiKey, createInvoice, UNKNOWN_UUID, UUID_V4 } from './helpers';

// Each run creates two small invoices on the target instance; they expire on
// their own after 10 minutes.
describe('Invoices API', () => {
  // null, not undefined: undefined would fall back to the default key.
  const post = (body: unknown, key: string | null = apiKey()) =>
    api.post('/invoices', body, {
      headers: key === null ? {} : { 'X-Api-Key': key },
    });

  describe('API key', () => {
    it('rejects a request without a key', async () => {
      const { status } = await post({ chain: 'xmr', fiatAmount: 1 }, null);
      expect(status).toBe(401);
    });

    it('rejects a wrong key', async () => {
      const { status } = await post(
        { chain: 'xmr', fiatAmount: 1 },
        'wrong-key-wrong-key',
      );
      expect(status).toBe(401);
    });

    it('protects GET /invoices/:publicId too', async () => {
      const { status } = await api.get(`/invoices/${UNKNOWN_UUID}`);
      expect(status).toBe(401);
    });
  });

  describe('validation', () => {
    it.each([
      ['neither amount', { chain: 'xmr' }],
      ['both amounts', { chain: 'xmr', fiatAmount: 1, amountAtomic: '1000' }],
      ['an unknown chain', { chain: 'doge', fiatAmount: 1 }],
      ['a zero atomic amount', { chain: 'xmr', amountAtomic: '0' }],
      ['a non-integer atomic amount', { chain: 'xmr', amountAtomic: '1.5' }],
      ['a fiat amount under one cent', { chain: 'xmr', fiatAmount: 0.001 }],
      [
        'an expiry under 60s',
        { chain: 'xmr', fiatAmount: 1, expiresInSeconds: 30 },
      ],
      [
        'zero confirmations',
        { chain: 'xmr', fiatAmount: 1, confirmationsRequired: 0 },
      ],
      [
        'a webhook URL without a protocol',
        { chain: 'xmr', fiatAmount: 1, webhookUrl: 'merchant.example' },
      ],
      [
        'a memo over 280 chars',
        { chain: 'xmr', fiatAmount: 1, memo: 'x'.repeat(281) },
      ],
      ['an unknown field', { chain: 'xmr', fiatAmount: 1, sneaky: true }],
    ])('rejects %s', async (_label, body) => {
      const { status } = await post(body);
      expect(status).toBe(400);
    });
  });

  describe('create and fetch', () => {
    let invoice: Record<string, any>;
    let sentAt: number;
    let receivedAt: number;

    beforeAll(async () => {
      sentAt = Date.now();
      invoice = await createInvoice({ confirmationsRequired: 3 });
      receivedAt = Date.now();
    });

    it('returns a pending invoice on a fresh subaddress', () => {
      expect(invoice).toMatchObject({
        chain: 'xmr',
        asset: 'xmr',
        assetDecimals: 12,
        amountAtomic: '1000000000',
        status: 'pending',
        confirmations: 0,
        confirmationsRequired: 3,
        receivedAtomic: '0',
        fiatCurrency: 'USD',
        memo: 'e2e test invoice',
        metadata: { source: 'e2e' },
      });
      expect(invoice.publicId).toMatch(UUID_V4);
      expect(typeof invoice.address).toBe('string');
      expect(invoice.addressIndex).toBeGreaterThan(0);
      expect(invoice.amountFiat).toBeGreaterThan(0);
      expect(invoice.rate).toBeGreaterThan(0);
    });

    // Measured against this machine's clock around the request, with 30s
    // allowed for clock skew against a remote instance.
    it('sets the expiry from expiresInSeconds', () => {
      const expiresAt = Date.parse(invoice.expiresAt);
      expect(expiresAt).toBeGreaterThanOrEqual(sentAt + 600_000 - 30_000);
      expect(expiresAt).toBeLessThanOrEqual(receivedAt + 600_000 + 30_000);
    });

    it('gives each invoice its own subaddress', async () => {
      const other = await createInvoice({
        amountAtomic: undefined,
        fiatAmount: 1.23,
      });
      expect(other.address).not.toBe(invoice.address);
      expect(other.addressIndex).not.toBe(invoice.addressIndex);
      expect(other.amountFiat).toBe(1.23);
      expect(BigInt(other.amountAtomic)).toBeGreaterThan(0n);
    });

    it('never exposes the internal id', () => {
      expect(invoice).not.toHaveProperty('id');
    });

    it('fetches the invoice by publicId', async () => {
      const { status, data } = await api.get(`/invoices/${invoice.publicId}`, {
        headers: { 'X-Api-Key': apiKey() },
      });
      expect(status).toBe(200);
      expect(data).toEqual(invoice);
    });

    it.each(['not-a-uuid', UNKNOWN_UUID])('404s on publicId %s', async (id) => {
      const { status } = await api.get(`/invoices/${id}`, {
        headers: { 'X-Api-Key': apiKey() },
      });
      expect(status).toBe(404);
    });
  });
});
