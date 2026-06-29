import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * A card that the user explicitly chose to save for faster future purchases.
 *
 * We never store the raw PAN. SUMIT keeps the card in its vault and gives us a
 * permanent `cardToken` that we charge against later (plus the masked last 4 and
 * expiry for display, and the cardholder's `citizenId`, which SUMIT requires for
 * bank validation on a token charge). One active saved card per user.
 */
@Entity('saved_payment_methods')
export class SavedPaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** One saved card per user — saving a new card replaces the old one. */
  @Column({ type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  /** SUMIT customer id the saved method is attached to. */
  @Column({ type: 'varchar' })
  sumitCustomerId: string;

  /** SUMIT permanent card token (CreditCard_Token) — not the raw card number. */
  @Column({ type: 'varchar' })
  cardToken: string;

  /** Last 4 digits for display, e.g. "1234". */
  @Column({ type: 'varchar', nullable: true, default: null })
  last4: string | null;

  /** Card brand/network for display (Visa/Mastercard/…), when SUMIT returns it. */
  @Column({ type: 'varchar', nullable: true, default: null })
  brand: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  expMonth: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  expYear: string | null;

  /** Cardholder citizen id — required by SUMIT/Shva to charge a saved token. */
  @Column({ type: 'varchar', nullable: true, default: null })
  citizenId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
