import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import {
  GenerationType,
  GenerationStatus,
  ImageQuality,
  ImageSize,
  ImageResolution,
  AiProvider,
} from '../common/constants';

@Entity('generations')
export class Generation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', default: GenerationType.IMAGE })
  type: GenerationType;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'varchar' })
  model: string;

  @Column({ type: 'varchar', default: GenerationStatus.PENDING })
  status: GenerationStatus;

  @Column({ type: 'varchar', nullable: true })
  resultUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  referenceImageUrls: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  quality: ImageQuality | null;

  @Column({ type: 'varchar', default: ImageSize.SQUARE })
  size: ImageSize;

  @Column({ type: 'varchar', nullable: true })
  resolution: ImageResolution | null;

  @Column({ type: 'varchar', default: AiProvider.MOCK })
  provider: AiProvider;

  // Video only: clip length in seconds. Null for images.
  @Column({ type: 'int', nullable: true })
  durationSeconds: number | null;

  // Video only: whether native audio was requested (v3 models).
  @Column({ type: 'boolean', nullable: true })
  generateAudio: boolean | null;

  @Column({ type: 'int', default: 0 })
  creditCost: number;

  @Column({ type: 'uuid', nullable: true })
  pricingRuleId: string | null;

  // Actual provider cost in USD, computed from token usage at generation time.
  @Column({ type: 'numeric', precision: 12, scale: 6, nullable: true })
  actualCostUsd: number | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'text', nullable: true })
  providerErrorRaw: string | null;

  @Column({ type: 'jsonb', nullable: true })
  tokensUsed: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    input_tokens_details?: { text_tokens?: number; image_tokens?: number };
    output_tokens_details?: { text_tokens?: number; image_tokens?: number };
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  // Soft delete: set when a user removes the creation from their list. Queries on
  // this entity exclude soft-deleted rows automatically; admin views opt back in
  // with `withDeleted()` to keep audit/cost history intact.
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
