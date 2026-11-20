import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LessThanOrEqual, Repository } from 'typeorm';
import { createHmac, randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';
import {
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookEvent,
} from './schemas/webhook-delivery.entity';
import type { EnvironmentVariables } from '../config/env.validation';
import { SettingsService } from '../settings/settings.service';
import { Chain } from '@mintit/types';

const CHAIN = Chain.Xmr;

@Injectable()
export class WebhooksService {
  private readonly log = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookDelivery)
    private readonly repo: Repository<WebhookDelivery>,
    private readonly http: HttpService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly settings: SettingsService,
  ) {}

  async enqueue(
    invoiceId: string,
    url: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const existing = await this.repo.findOne({
      where: { chain: CHAIN, invoiceId, event },
    });
    if (existing) return;

    await this.repo.save(
      this.repo.create({
        chain: CHAIN,
        invoiceId,
        url,
        event,
        payload: {
          id: randomUUID(),
          event,
          timestamp: new Date().toISOString(),
          data: payload,
        },
        attempts: 0,
        nextAttemptAt: new Date(),
        status: WebhookDeliveryStatus.Pending,
      }),
    );
  }

  async dispatchDue(): Promise<void> {
    const now = new Date();
    const due = await this.repo.find({
      where: {
        status: WebhookDeliveryStatus.Pending,
        nextAttemptAt: LessThanOrEqual(now),
      },
      take: 20,
    });

    await Promise.all(due.map((d) => this.attempt(d)));
  }

  private async attempt(delivery: WebhookDelivery): Promise<void> {
    const secret = this.config.get('WEBHOOK_SIGNING_SECRET', { infer: true });
    // Global settings: the per-chain copies are only seeded once and never
    // follow PUT /admin/settings/global.
    const { webhookMaxAttempts: maxAttempts, webhookTimeoutMs: timeout } =
      this.settings.getGlobal();
    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    delivery.attempts += 1;

    try {
      const res = await firstValueFrom(
        this.http.post(delivery.url, body, {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Signature': `t=${timestamp},v1=${signature}`,
            'X-Api-Event': delivery.event,
            'X-Api-Delivery-Id': delivery.id,
          },
          timeout,
          validateStatus: () => true,
        }),
      );
      delivery.lastResponseCode = res.status;
      if (res.status >= 200 && res.status < 300) {
        delivery.status = WebhookDeliveryStatus.Delivered;
        delivery.lastError = undefined;
      } else {
        delivery.lastError = `HTTP ${res.status}`;
        this.scheduleRetry(delivery, maxAttempts);
      }
    } catch (err) {
      delivery.lastError = (err as Error).message;
      this.scheduleRetry(delivery, maxAttempts);
    }

    await this.repo.save(delivery);
  }

  private scheduleRetry(delivery: WebhookDelivery, max: number): void {
    if (delivery.attempts >= max) {
      delivery.status = WebhookDeliveryStatus.DeadLettered;
      this.log.warn(
        `Webhook ${delivery.id} dead-lettered after ${delivery.attempts} attempts`,
      );
      return;
    }
    const base = 30_000;
    const delay = Math.min(
      base * Math.pow(2, delivery.attempts - 1),
      60 * 60_000,
    );
    delivery.nextAttemptAt = new Date(Date.now() + delay);
    delivery.status = WebhookDeliveryStatus.Pending;
  }
}
