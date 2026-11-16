import { Chain } from '@mintit/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Invoice } from '../../invoices/schemas/invoice.entity';

@Entity({ name: 'payments' })
@Index(['chain', 'txHash', 'addressIndex'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
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
  address!: string;

  @Index()
  @Column()
  addressIndex!: number;

  @Column()
  txHash!: string;

  @Column()
  amountAtomic!: string;

  @Column({ default: 0 })
  confirmations!: number;

  @Column({ default: false })
  unlocked!: boolean;

  @Column({ nullable: true })
  blockHeight?: number;

  @Column()
  firstSeenAt!: Date;

  @Column({ nullable: true })
  confirmedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
