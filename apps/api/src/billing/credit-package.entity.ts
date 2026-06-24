import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

const numericTransformer = {
  to: (value?: number | null) => value,
  from: (value: string | number | null) =>
    value === null || value === undefined ? null : Number(value),
};

/**
 * A purchasable credit pack. Larger packs grant more credits per shekel (the
 * best rate equals the target margin); smaller packs cost more per credit, so
 * buying small simply yields extra profit.
 */
@Entity('credit_packages')
export class CreditPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

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

  /** Optional marketing badge, e.g. "הכי משתלם". */
  @Column({ type: 'varchar', nullable: true, default: null })
  badge: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
