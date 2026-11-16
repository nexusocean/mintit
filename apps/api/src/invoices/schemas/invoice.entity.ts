import { Asset, Chain, InvoiceStatus } from '@mintit/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'invoices' })
@Index(['createdAt'])
@Index(['chain', 'address'])
@Index(['chain', 'status'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, default: () => 'gen_random_uuid()' })
  publicId!: string;

  @Index()
  @Column({ type: 'enum', enum: Chain })
  chain!: Chain;

  @Index()
  @Column({ type: 'enum', enum: Asset })
  asset!: Asset;

  @Column()
  assetDecimals!: number;

  @Index()
  @Column()
  address!: string;

  @Column()
  addressIndex!: number;

  @Column()
  amountAtomic!: string;

  @Column('double precision')
  amountFiat!: number;

  @Column()
  fiatCurrency!: string;

  @Column('double precision')
  rate!: number;

  @Column()
  rateLockedAt!: Date;

  @Column()
  expiresAt!: Date;

  @Index()
  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.Pending })
  status!: InvoiceStatus;

  @Column()
  confirmationsRequired!: number;

  @Column({ default: 0 })
  confirmations!: number;

  @Column({ default: '0' })
  receivedAtomic!: string;

  @Column({ nullable: true })
  firstSeenAt?: Date;

  @Column({ nullable: true })
  paidAt?: Date;

  @Column({ nullable: true })
  webhookUrl?: string;

  @Column({ nullable: true })
  memo?: string;

  @Column('jsonb', { nullable: true })
  chainData?: Record<string, unknown>;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
