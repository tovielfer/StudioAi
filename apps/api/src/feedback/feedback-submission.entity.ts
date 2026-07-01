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
  EMAIL = 'email',
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

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  contactEmail: string | null;

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

  // Unique per-thread token embedded in the reply-to address
  // (reply+<threadToken>@inbound...) so inbound email replies can be matched
  // back to this conversation.
  @Column({ type: 'varchar', nullable: true, unique: true })
  threadToken: string | null;

  // Timestamp of the most recent message in the thread (inbound or outbound).
  // Used to sort the admin inbox by latest activity.
  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  // Whether the user has seen the latest admin reply. Reset to false each time
  // a new reply is added so the user gets a fresh notification.
  @Column({ type: 'boolean', default: false })
  userReplyRead: boolean;

  // Whether an admin has opened/seen this submission. New submissions start
  // as unread so the admin gets notified about incoming inquiries.
  @Column({ type: 'boolean', default: false })
  adminRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
