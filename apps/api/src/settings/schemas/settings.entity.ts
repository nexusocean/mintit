import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'settings' })
export class Settings {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ unique: true })
  key!: string;

  @Column({ type: 'int', nullable: true })
  confirmationDepth?: number;

  @Column({ type: 'int', nullable: true })
  invoiceDefaultExpirySec?: number;

  @Column({ type: 'int', nullable: true })
  scannerLockTtlMs?: number;

  @Column({ type: 'int', nullable: true })
  syncedThresholdBlocks?: number;

  @Column({ type: 'int', nullable: true })
  rateCacheTtlMs?: number;

  @Column({ type: 'int', nullable: true })
  webhookMaxAttempts?: number;

  @Column({ type: 'int', nullable: true })
  webhookTimeoutMs?: number;

  @Column({ type: 'int', nullable: true })
  webhookDispatchIntervalMs?: number;

  @Column({ type: 'int', nullable: true })
  underpaymentToleranceCents?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
