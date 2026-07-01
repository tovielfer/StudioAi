import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import {
  FeedbackStatus,
  FeedbackSubmission,
} from './feedback-submission.entity';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(FeedbackSubmission)
    private readonly feedbackRepo: Repository<FeedbackSubmission>,
    private readonly mailService: MailService,
  ) {}

  create(userId: string, dto: CreateFeedbackDto) {
    const submission = this.feedbackRepo.create({
      userId,
      type: dto.type,
      title: dto.title?.trim() ?? '',
      message: dto.message.trim(),
    });

    return this.feedbackRepo.save(submission);
  }

  createPublic(dto: CreateFeedbackDto) {
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
    });

    return this.feedbackRepo.save(submission);
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
      .addSelect('feedback.createdAt', 'createdAt')
      .orderBy('feedback.createdAt', 'DESC')
      .take(params.limit)
      .skip(params.offset)
      .getRawMany();

    return { items, total };
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

    let shouldSendEmail = false;
    if (dto.adminReply !== undefined) {
      const nextReply = dto.adminReply.trim() || null;
      // When the reply content changes (and is non-empty), surface a fresh
      // notification to the user.
      if (nextReply && nextReply !== item.adminReply) {
        item.userReplyRead = false;
        shouldSendEmail = true;
      }
      item.adminReply = nextReply;
    }

    if (item.adminReply && item.status === FeedbackStatus.OPEN) {
      item.status = FeedbackStatus.ANSWERED;
    }

    item.answeredAt =
      item.adminReply && item.status === FeedbackStatus.ANSWERED
        ? new Date()
        : item.answeredAt;

    const saved = await this.feedbackRepo.save(item);

    const replyTo = item.user?.email ?? item.contactEmail;
    if (shouldSendEmail && item.adminReply && replyTo) {
      this.mailService
        .sendFeedbackReply({
          to: replyTo,
          feedbackTitle: item.title,
          feedbackMessage: item.message,
          adminReply: item.adminReply,
        })
        .catch((err: unknown) =>
          this.logger.error(
            `Failed to send feedback reply email to ${replyTo}: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }

    return saved;
  }
}
