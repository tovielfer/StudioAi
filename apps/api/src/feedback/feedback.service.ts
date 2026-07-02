import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { IsNull, Not, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import {
  FeedbackMessage,
  FeedbackMessageAttachment,
  FeedbackMessageAuthorType,
  FeedbackMessageDirection,
} from './feedback-message.entity';
import {
  FeedbackStatus,
  FeedbackSubmission,
  FeedbackType,
} from './feedback-submission.entity';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(FeedbackSubmission)
    private readonly feedbackRepo: Repository<FeedbackSubmission>,
    @InjectRepository(FeedbackMessage)
    private readonly messageRepo: Repository<FeedbackMessage>,
    private readonly mailService: MailService,
  ) {}

  private generateThreadToken() {
    return randomUUID().replace(/-/g, '');
  }

  // Appends a message to a thread and bumps the submission's lastMessageAt so
  // the admin inbox can sort by most-recent activity.
  private async appendMessage(
    feedback: FeedbackSubmission,
    data: {
      direction: FeedbackMessageDirection;
      authorType: FeedbackMessageAuthorType;
      body: string;
      emailMessageId?: string | null;
      attachments?: FeedbackMessageAttachment[] | null;
      createdAt?: Date;
    },
  ) {
    const message = this.messageRepo.create({
      feedbackId: feedback.id,
      direction: data.direction,
      authorType: data.authorType,
      body: data.body,
      emailMessageId: data.emailMessageId ?? null,
      attachments: data.attachments ?? null,
      ...(data.createdAt ? { createdAt: data.createdAt } : {}),
    });
    const saved = await this.messageRepo.save(message);

    feedback.lastMessageAt = saved.createdAt ?? new Date();
    await this.feedbackRepo.save(feedback);

    return saved;
  }

  async create(userId: string, dto: CreateFeedbackDto) {
    const submission = this.feedbackRepo.create({
      userId,
      type: dto.type,
      title: dto.title?.trim() ?? '',
      message: dto.message.trim(),
      threadToken: this.generateThreadToken(),
      lastMessageAt: new Date(),
    });

    const saved = await this.feedbackRepo.save(submission);
    await this.appendMessage(saved, {
      direction: FeedbackMessageDirection.INBOUND,
      authorType: FeedbackMessageAuthorType.USER,
      body: saved.message,
    });

    return saved;
  }

  async createPublic(dto: CreateFeedbackDto) {
    const contactEmail = dto.contactEmail?.trim().toLowerCase();
    if (!contactEmail) {
      throw new BadRequestException('Contact email is required');
    }

    const submission = this.feedbackRepo.create({
      userId: null,
      contactEmail,
      type: dto.type,
      title: dto.title?.trim() ?? '',
      message: dto.message.trim(),
      threadToken: this.generateThreadToken(),
      lastMessageAt: new Date(),
    });

    const saved = await this.feedbackRepo.save(submission);
    await this.appendMessage(saved, {
      direction: FeedbackMessageDirection.INBOUND,
      authorType: FeedbackMessageAuthorType.USER,
      body: saved.message,
    });

    return saved;
  }

  async countUnreadRepliesForUser(userId: string) {
    const unread = await this.feedbackRepo.count({
      where: { userId, adminReply: Not(IsNull()), userReplyRead: false },
    });
    return { unread };
  }

  async markRepliesReadForUser(userId: string) {
    await this.feedbackRepo.update(
      { userId, adminReply: Not(IsNull()), userReplyRead: false },
      { userReplyRead: true },
    );
    return { unread: 0 };
  }

  async countNewForAdmin() {
    const unread = await this.feedbackRepo.count({
      where: { adminRead: false },
    });
    return { unread };
  }

  async markAllReadForAdmin() {
    await this.feedbackRepo.update({ adminRead: false }, { adminRead: true });
    return { unread: 0 };
  }

  async listByUser(userId: string, params: { limit: number; offset: number }) {
    const [items, total] = await this.feedbackRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: params.limit,
      skip: params.offset,
    });

    return { items, total };
  }

  async listAdmin(params: { limit: number; offset: number }) {
    const qb = this.feedbackRepo
      .createQueryBuilder('feedback')
      .leftJoin('feedback.user', 'user');

    const total = await qb.clone().getCount();
    const items = await qb
      .select('feedback.id', 'id')
      .addSelect('feedback.userId', 'userId')
      .addSelect('user.email', 'userEmail')
      .addSelect('feedback.contactEmail', 'contactEmail')
      .addSelect('feedback.type', 'type')
      .addSelect('feedback.title', 'title')
      .addSelect('feedback.message', 'message')
      .addSelect('feedback.status', 'status')
      .addSelect('feedback.adminReply', 'adminReply')
      .addSelect('feedback.answeredAt', 'answeredAt')
      .addSelect('feedback.adminRead', 'adminRead')
      .addSelect('feedback.createdAt', 'createdAt')
      .addSelect('feedback.lastMessageAt', 'lastMessageAt')
      .orderBy(
        'COALESCE(feedback.lastMessageAt, feedback.createdAt)',
        'DESC',
      )
      .take(params.limit)
      .skip(params.offset)
      .getRawMany();

    return { items, total };
  }

  // Returns the full ordered conversation for a thread.
  async listMessages(feedbackId: string) {
    const feedback = await this.feedbackRepo.findOne({
      where: { id: feedbackId },
    });
    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    const items = await this.messageRepo.find({
      where: { feedbackId },
      order: { createdAt: 'ASC' },
    });

    return { items };
  }

  // Same as listMessages but scoped to the owning user so people can only read
  // their own conversations.
  async listMessagesForUser(feedbackId: string, userId: string) {
    const feedback = await this.feedbackRepo.findOne({
      where: { id: feedbackId },
    });
    if (!feedback || feedback.userId !== userId) {
      throw new NotFoundException('Feedback not found');
    }

    const items = await this.messageRepo.find({
      where: { feedbackId },
      order: { createdAt: 'ASC' },
    });

    return { items };
  }

  // A user replies to their own conversation: append an inbound message and
  // re-flag the thread as unread for the admin so it resurfaces in the inbox.
  async replyUser(feedbackId: string, userId: string, reply: string) {
    const body = reply.trim();
    if (!body) {
      throw new BadRequestException('Reply message is required');
    }

    const item = await this.feedbackRepo.findOne({
      where: { id: feedbackId },
    });
    if (!item || item.userId !== userId) {
      throw new NotFoundException('Feedback not found');
    }

    await this.appendMessage(item, {
      direction: FeedbackMessageDirection.INBOUND,
      authorType: FeedbackMessageAuthorType.USER,
      body,
    });

    // A follow-up from the user reopens the conversation for the admin.
    item.adminRead = false;
    if (
      item.status === FeedbackStatus.CLOSED ||
      item.status === FeedbackStatus.ANSWERED
    ) {
      item.status = FeedbackStatus.OPEN;
    }
    return this.feedbackRepo.save(item);
  }

  // Admin sends a reply: append an outbound message, update the submission's
  // status/flags, and email the recipient with a thread-scoped reply-to so
  // their response comes back into this same conversation.
  async replyAdmin(id: string, reply: string) {
    const body = reply.trim();
    if (!body) {
      throw new BadRequestException('Reply message is required');
    }

    const item = await this.feedbackRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!item) {
      throw new NotFoundException('Feedback not found');
    }

    await this.appendMessage(item, {
      direction: FeedbackMessageDirection.OUTBOUND,
      authorType: FeedbackMessageAuthorType.ADMIN,
      body,
    });

    item.adminReply = body;
    item.adminRead = true;
    item.userReplyRead = false;
    if (item.status === FeedbackStatus.OPEN) {
      item.status = FeedbackStatus.ANSWERED;
    }
    item.answeredAt = new Date();
    const saved = await this.feedbackRepo.save(item);

    const to = item.user?.email ?? item.contactEmail;
    if (to) {
      this.mailService
        .sendFeedbackReply({
          to,
          feedbackTitle: item.title,
          feedbackMessage: item.message,
          adminReply: body,
          threadToken: item.threadToken,
        })
        .catch((err: unknown) =>
          this.logger.error(
            `Failed to send feedback reply email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }

    return saved;
  }

  async updateAdmin(id: string, dto: UpdateFeedbackDto) {
    const item = await this.feedbackRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!item) {
      throw new NotFoundException('Feedback not found');
    }

    // The admin is interacting with this submission, so it's no longer "new".
    item.adminRead = true;

    if (dto.status) {
      item.status = dto.status;
    }

    // Legacy support: a reply sent through the update endpoint is routed
    // through the same threaded reply flow.
    if (dto.adminReply !== undefined) {
      const nextReply = dto.adminReply.trim();
      if (nextReply && nextReply !== item.adminReply) {
        await this.feedbackRepo.save(item);
        return this.replyAdmin(id, nextReply);
      }
    }

    return this.feedbackRepo.save(item);
  }

  // ─── Inbound email handling ─────────────────────────────────────────────

  async findByThreadToken(threadToken: string) {
    return this.feedbackRepo.findOne({ where: { threadToken } });
  }

  private async isDuplicateInbound(emailMessageId: string | null) {
    if (!emailMessageId) return false;
    const existing = await this.messageRepo.count({ where: { emailMessageId } });
    return existing > 0;
  }

  // Appends an inbound email reply to an existing thread and re-flags it as
  // unread for the admin.
  async addInboundReply(params: {
    threadToken: string;
    body: string;
    emailMessageId?: string | null;
    attachments?: FeedbackMessageAttachment[] | null;
  }) {
    const feedback = await this.findByThreadToken(params.threadToken);
    if (!feedback) {
      return null;
    }

    if (await this.isDuplicateInbound(params.emailMessageId ?? null)) {
      this.logger.log(
        `Skipping duplicate inbound email ${params.emailMessageId}`,
      );
      return feedback;
    }

    await this.appendMessage(feedback, {
      direction: FeedbackMessageDirection.INBOUND,
      authorType: FeedbackMessageAuthorType.USER,
      body: params.body,
      emailMessageId: params.emailMessageId ?? null,
      attachments: params.attachments ?? null,
    });

    feedback.adminRead = false;
    if (feedback.status === FeedbackStatus.CLOSED) {
      feedback.status = FeedbackStatus.OPEN;
    }
    await this.feedbackRepo.save(feedback);

    return feedback;
  }

  // Creates a brand-new thread from an inbound email that isn't a reply to an
  // existing conversation.
  async createFromInboundEmail(params: {
    fromEmail: string;
    subject: string;
    body: string;
    emailMessageId?: string | null;
    attachments?: FeedbackMessageAttachment[] | null;
  }) {
    if (await this.isDuplicateInbound(params.emailMessageId ?? null)) {
      this.logger.log(
        `Skipping duplicate inbound email ${params.emailMessageId}`,
      );
      return null;
    }

    const submission = this.feedbackRepo.create({
      userId: null,
      contactEmail: params.fromEmail.trim().toLowerCase(),
      type: FeedbackType.EMAIL,
      title: (params.subject || '(ללא נושא)').slice(0, 120),
      message: params.body,
      status: FeedbackStatus.OPEN,
      adminRead: false,
      threadToken: this.generateThreadToken(),
      lastMessageAt: new Date(),
    });
    const saved = await this.feedbackRepo.save(submission);

    await this.appendMessage(saved, {
      direction: FeedbackMessageDirection.INBOUND,
      authorType: FeedbackMessageAuthorType.USER,
      body: params.body,
      emailMessageId: params.emailMessageId ?? null,
      attachments: params.attachments ?? null,
    });

    return saved;
  }
}
