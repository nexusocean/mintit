import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'backup_codes' })
@Index(['userId', 'codeHash'])
export class BackupCode {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  // Keyed HMAC of the code (see hashBackupCode); the code itself is never kept.
  @Column()
  codeHash!: string;

  // Issued by a TOTP reset that hasn't been confirmed yet; not usable to log in.
  @Column({ default: false })
  pending!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
