import { createHmac } from 'crypto';
import { of, throwError } from 'rxjs';
import { Chain } from '@mintit/types';
import { WebhooksService } from '../../src/webhooks/webhooks.service';
import {
  WebhookDeliveryStatus,
  WebhookEvent,
} from '../../src/webhooks/schemas/webhook-delivery.entity';

const SECRET = 'test-signing-secret';
const NOW = new Date('2026-01-01T00:00:00Z');

function setup(opts: { maxAttempts?: number; timeoutMs?: number } = {}) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((d) => d),
    save: jest.fn(async (d) => d),
  };
  const http = { post: jest.fn() };
  const config = { get: jest.fn(() => SECRET) };
  const settings = {
    // The per-chain copy is stale on purpose: webhook settings are global.
    get: jest.fn(() => 1),
    getGlobal: jest.fn(() => ({
      webhookMaxAttempts: opts.maxAttempts ?? 8,
      webhookTimeoutMs: opts.timeoutMs ?? 10_000,
    })),
  };
  const service = new WebhooksService(
    repo as never,
    http as never,
    config as never,
    settings as never,
  );
  return { service, repo, http };
}

function delivery(over: Record<string, unknown> = {}) {
  return {
    id: 'del-1',
    chain: Chain.Xmr,
    invoiceId: 'inv-1',
    url: 'https://merchant.example/hook',
    event: WebhookEvent.InvoiceConfirmed,
    payload: { id: 'evt-1', event: 'invoice.confirmed', data: { a: 1 } },
    attempts: 0,
    status: WebhookDeliveryStatus.Pending,
    nextAttemptAt: NOW,
    ...over,
  };
}

async function dispatchOne(
  t: ReturnType<typeof setup>,
  d: ReturnType<typeof delivery>,
) {
  t.repo.find.mockResolvedValueOnce([d]);
  await t.service.dispatchDue();
  return d;
}

describe('WebhooksService', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());

  describe('enqueue', () => {
    it('stores a pending delivery with an event envelope', async () => {
      const t = setup();
      await t.service.enqueue(
        'inv-1',
        'https://x.example',
        WebhookEvent.InvoiceSeen,
        {
          invoiceId: 'inv-1',
        },
      );

      const saved = t.repo.save.mock.calls[0][0];
      expect(saved.status).toBe(WebhookDeliveryStatus.Pending);
      expect(saved.attempts).toBe(0);
      expect(saved.payload).toMatchObject({
        event: WebhookEvent.InvoiceSeen,
        timestamp: NOW.toISOString(),
        data: { invoiceId: 'inv-1' },
      });
      expect(saved.payload.id).toEqual(expect.any(String));
    });

    it('does not enqueue the same event twice for an invoice', async () => {
      const t = setup();
      t.repo.findOne.mockResolvedValueOnce(delivery());
      await t.service.enqueue(
        'inv-1',
        'https://x.example',
        WebhookEvent.InvoiceConfirmed,
        {},
      );
      expect(t.repo.save).not.toHaveBeenCalled();
    });
  });

  describe('dispatch', () => {
    it('signs the body as HMAC-SHA256 of "timestamp.body"', async () => {
      const t = setup();
      t.http.post.mockReturnValue(of({ status: 200 }));
      const d = await dispatchOne(t, delivery());

      const [url, body, cfg] = t.http.post.mock.calls[0];
      const ts = Math.floor(NOW.getTime() / 1000).toString();
      const expected = createHmac('sha256', SECRET)
        .update(`${ts}.${body}`)
        .digest('hex');

      expect(url).toBe(d.url);
      expect(body).toBe(JSON.stringify(d.payload));
      expect(cfg.headers['X-Api-Signature']).toBe(`t=${ts},v1=${expected}`);
      expect(cfg.headers['X-Api-Event']).toBe(d.event);
      expect(cfg.headers['X-Api-Delivery-Id']).toBe(d.id);
    });

    it('marks a 2xx response delivered', async () => {
      const t = setup();
      t.http.post.mockReturnValue(of({ status: 204 }));
      const d = await dispatchOne(t, delivery());

      expect(d.status).toBe(WebhookDeliveryStatus.Delivered);
      expect(d.attempts).toBe(1);
      expect(t.repo.save).toHaveBeenCalledWith(d);
    });

    it('retries a non-2xx response after 30s', async () => {
      const t = setup();
      t.http.post.mockReturnValue(of({ status: 500 }));
      const d = await dispatchOne(t, delivery());

      expect(d.status).toBe(WebhookDeliveryStatus.Pending);
      expect((d as Record<string, unknown>).lastError).toBe('HTTP 500');
      expect(d.nextAttemptAt.getTime()).toBe(NOW.getTime() + 30_000);
    });

    it('retries a network error', async () => {
      const t = setup();
      t.http.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
      const d = await dispatchOne(t, delivery());

      expect(d.status).toBe(WebhookDeliveryStatus.Pending);
      expect((d as Record<string, unknown>).lastError).toBe('ECONNREFUSED');
    });

    it('doubles the backoff each attempt, capped at one hour', async () => {
      const t = setup({ maxAttempts: 100 });
      t.http.post.mockReturnValue(of({ status: 500 }));

      const third = await dispatchOne(t, delivery({ attempts: 2 }));
      expect(third.nextAttemptAt.getTime() - NOW.getTime()).toBe(120_000);

      const late = await dispatchOne(t, delivery({ attempts: 20 }));
      expect(late.nextAttemptAt.getTime() - NOW.getTime()).toBe(3_600_000);
    });

    it('dead-letters after the last allowed attempt', async () => {
      const t = setup({ maxAttempts: 3 });
      t.http.post.mockReturnValue(of({ status: 500 }));
      const d = await dispatchOne(t, delivery({ attempts: 2 }));

      expect(d.attempts).toBe(3);
      expect(d.status).toBe(WebhookDeliveryStatus.DeadLettered);
    });

    it('uses the global max attempts and timeout, not the per-chain copy', async () => {
      const t = setup({ maxAttempts: 5, timeoutMs: 2_500 });
      t.http.post.mockReturnValue(of({ status: 500 }));
      const d = await dispatchOne(t, delivery({ attempts: 1 }));

      expect(t.http.post.mock.calls[0][2].timeout).toBe(2_500);
      // A stale per-chain max of 1 would dead-letter this second attempt.
      expect(d.status).toBe(WebhookDeliveryStatus.Pending);
    });
  });
});

describe('WebhooksService.getAttempts', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    ...delivery({
      url: 'https://webhook.site/d11def35-5475-4331-9b40-3f310f729514',
    }),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:30Z'),
    ...over,
  });

  it("queries the invoice's deliveries newest first", async () => {
    const t = setup();
    await t.service.getAttempts('inv-1');

    expect(t.repo.find).toHaveBeenCalledWith({
      where: { chain: Chain.Xmr, invoiceId: 'inv-1' },
      order: { createdAt: 'DESC' },
    });
  });

  it('returns an empty list when nothing has been sent', async () => {
    await expect(setup().service.getAttempts('inv-1')).resolves.toEqual([]);
  });

  it('maps every row to the response fields, without payload or url', async () => {
    const t = setup();
    t.repo.find.mockResolvedValueOnce([
      row({
        id: 'del-2',
        event: WebhookEvent.InvoiceConfirmed,
        status: WebhookDeliveryStatus.DeadLettered,
        attempts: 8,
        lastResponseCode: 503,
        lastError: 'HTTP 503',
      }),
      row({ id: 'del-1', event: WebhookEvent.InvoiceSeen }),
    ]);

    const result = await t.service.getAttempts('inv-1');

    expect(result).toEqual([
      {
        id: 'del-2',
        event: WebhookEvent.InvoiceConfirmed,
        status: WebhookDeliveryStatus.DeadLettered,
        attempts: 8,
        lastResponseCode: 503,
        lastError: 'HTTP 503',
        nextAttemptAt: NOW.toISOString(),
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:30.000Z',
      },
      expect.objectContaining({ id: 'del-1', event: WebhookEvent.InvoiceSeen }),
    ]);
    for (const r of result) {
      expect(r).not.toHaveProperty('payload');
      expect(r).not.toHaveProperty('url');
    }
  });
});
