import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FeedbackSubmission } from './feedback-submission.entity';

export enum FeedbackMessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum FeedbackMessageAuthorType {
  USER = 'user',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

export interface FeedbackMessageAttachment {
  filename: string;
  contentType: string;
  url?: string;
}

@Entity('feedback_messages')
export class FeedbackMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  feedbackId: string;

  @ManyToOne(() => FeedbackSubmission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feedbackId' })
  feedback: FeedbackSubmission;

  @Column({ type: 'varchar' })
  direction: FeedbackMessageDirection;

  @Column({ type: 'varchar' })
  authorType: FeedbackMessageAuthorType;

  @Column({ type: 'text' })
  body: string;

  // The provider Message-ID / email id, kept to de-duplicate inbound webhook
  // deliveries (providers can deliver the same event more than once).
  @Column({ type: 'varchar', nullable: true })
  emailMessageId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments: FeedbackMessageAttachment[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
