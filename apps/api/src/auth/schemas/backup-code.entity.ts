import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'backup_codes' })
// Names match the migration that created them (BackupCodesAndTotpReset).
@Index('IDX_backup_codes_userId_codeHash', ['userId', 'codeHash'])
export class BackupCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_backup_codes_userId',
  })
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
