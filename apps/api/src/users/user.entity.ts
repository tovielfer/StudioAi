import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Generation } from '../generations/generation.entity';
import { CreditTransaction } from '../credits/credit-transaction.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  nickname: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  passwordHash: string | null;

  @Column({ type: 'varchar', nullable: true, default: null, unique: true })
  googleId: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  avatarUrl: string | null;

  @Column({ default: 150 })
  credits: number;

  @Column({ type: 'varchar', default: UserRole.USER })
  role: UserRole;

  @Column({ default: false })
  isBlocked: boolean;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', nullable: true, default: null })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  emailVerificationExpiry: Date | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  resetPasswordToken: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  resetPasswordExpiry: Date | null;

  /**
   * When the one-time "installed the app" credit bonus was granted. Null means
   * the user hasn't claimed it yet; a timestamp both records the grant and acts
   * as the idempotency guard so the bonus can never be given twice.
   */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  installRewardGrantedAt: Date | null;

  /** SUMIT customer id, saved after a successful charge for reuse. */
  @Column({ type: 'varchar', nullable: true, default: null })
  sumitCustomerId: string | null;

  /** SUMIT payment-method (token) id of the saved card, for future charges. */
  @Column({ type: 'varchar', nullable: true, default: null })
  sumitPaymentMethodId: string | null;

  /** Masked last digits of the saved card, for display only. */
  @Column({ type: 'varchar', nullable: true, default: null })
  savedCardLast4: string | null;

  /** Brand of the saved card, for display only. */
  @Column({ type: 'varchar', nullable: true, default: null })
  savedCardBrand: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Generation, (g) => g.user)
  generations: Generation[];

  @OneToMany(() => CreditTransaction, (t) => t.user)
  creditTransactions: CreditTransaction[];
}
