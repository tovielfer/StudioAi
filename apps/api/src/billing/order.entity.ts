import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum OrderStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

const numericTransformer = {
  to: (value?: number | null) => value,
  from: (value: string | number | null) =>
    value === null || value === undefined ? null : Number(value),
};

/**
 * A credit purchase request. Currently fulfilled by an admin approval (manual
 * billing). The `provider`/`providerRef` columns are the future injection point
 * for a real payment gateway (a webhook would set status=approved instead of an
 * admin).
 */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Nullable so an order survives deletion of its package. */
  @Column({ type: 'uuid', nullable: true, default: null })
  packageId: string | null;

  /** Snapshot of the package name at purchase time. */
  @Column()
  packageName: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  priceIls: number;

  @Column({ type: 'int', default: 0 })
  credits: number;

  @Column({ type: 'varchar', default: OrderStatus.PENDING })
  status: OrderStatus;

  /** Future payment provider id (null = manual admin approval). */
  @Column({ type: 'varchar', nullable: true, default: null })
  provider: string | null;

  /** Future payment provider transaction reference. */
  @Column({ type: 'varchar', nullable: true, default: null })
  providerRef: string | null;

  /** Optional note from the buyer (e.g. payment method / contact). */
  @Column({ type: 'varchar', nullable: true, default: null })
  note: string | null;

  @Column({ type: 'uuid', nullable: true, default: null })
  decidedByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  decidedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
