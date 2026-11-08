import { UserScope } from '@mintit/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ select: false })
  password!: string;

  @Column({ nullable: true, select: false })
  totpSecret?: string;

  @Column({ nullable: true, select: false })
  lastUsedTotp?: string;

  // A replacement secret from a TOTP reset, swapped in only once a code from
  // it is confirmed, so an abandoned reset leaves the current secret working.
  @Column({ type: 'varchar', nullable: true, select: false })
  pendingTotpSecret?: string | null;

  @Column('text', { array: true, default: () => `'{${UserScope.ADMIN}}'` })
  scope!: UserScope[];

  @Column({ default: false })
  isValid!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
