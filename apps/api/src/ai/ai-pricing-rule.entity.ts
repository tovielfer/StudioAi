import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  AiProvider,
  GenerationType,
  ImageQuality,
  ImageResolution,
  ImageSize,
} from '../common/constants';

const numericTransformer = {
  to: (value?: number | null) => value,
  from: (value: string | number | null) =>
    value === null || value === undefined ? null : Number(value),
};

@Entity('ai_pricing_rules')
export class AiPricingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', default: GenerationType.IMAGE })
  type: GenerationType;

  @Column({ type: 'varchar', nullable: true })
  provider: AiProvider | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ type: 'varchar', nullable: true })
  size: ImageSize | null;

  @Column({ type: 'varchar', nullable: true })
  quality: ImageQuality | null;

  @Column({ type: 'varchar', nullable: true })
  resolution: ImageResolution | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 6,
    default: 0,
    transformer: numericTransformer,
  })
  baseUsd: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 6,
    default: 0,
    transformer: numericTransformer,
  })
  referenceImageUsd: number;

  @Column({
    type: 'numeric',
    precision: 8,
    scale: 4,
    default: 1,
    transformer: numericTransformer,
  })
  margin: number;

  @Column({ type: 'int', nullable: true })
  creditCostOverride: number | null;

  @Column({ type: 'boolean', default: false })
  isModelDefault: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
