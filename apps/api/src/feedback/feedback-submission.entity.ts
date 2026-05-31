import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum FeedbackType {
  REQUEST = 'request',
  NOTE = 'note',
  IMPROVEMENT = 'improvement',
  SHORTCUT = 'shortcut',
  OTHER = 'other',
}

export enum FeedbackStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  ANSWERED = 'answered',
  CLOSED = 'closed',
}

@Entity('feedback_submissions')
export class FeedbackSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', default: FeedbackType.REQUEST })
  type: FeedbackType;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', default: FeedbackStatus.OPEN })
  status: FeedbackStatus;

  @Column({ type: 'text', nullable: true })
  adminReply: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  answeredAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
