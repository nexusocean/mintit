import { Chain } from '@mintit/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Invoice } from '../../invoices/schemas/invoice.entity';

export enum WebhookEvent {
  InvoiceSeen = 'invoice.seen',
  InvoiceConfirmed = 'invoice.confirmed',
  InvoiceUnderpaid = 'invoice.underpaid',
  InvoiceExpired = 'invoice.expired',
  InvoiceCancelled = 'invoice.cancelled',
}

export enum WebhookDeliveryStatus {
  Pending = 'pending',
  Delivered = 'delivered',
  Failed = 'failed',
  DeadLettered = 'dead_lettered',
}

@Entity({ name: 'webhook_deliveries' })
export class WebhookDelivery {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Index()
  @Column({ type: 'enum', enum: Chain })
  chain!: Chain;

  @Index()
  @Column()
  invoiceId!: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: Invoice;

  @Column()
  url!: string;

  @Column({ type: 'enum', enum: WebhookEvent })
  event!: WebhookEvent;

  @Column('jsonb')
  payload!: Record<string, unknown>;

  @Column({ default: 0 })
  attempts!: number;

  @Index()
  @Column()
  nextAttemptAt!: Date;

  @Index()
  @Column({
    type: 'enum',
    enum: WebhookDeliveryStatus,
    default: WebhookDeliveryStatus.Pending,
  })
  status!: WebhookDeliveryStatus;

  @Column({ nullable: true })
  lastResponseCode?: number;

  @Column({ nullable: true })
  lastError?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
