import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import {
  FeedbackStatus,
  FeedbackSubmission,
} from './feedback-submission.entity';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(FeedbackSubmission)
    private readonly feedbackRepo: Repository<FeedbackSubmission>,
  ) {}

  create(userId: string, dto: CreateFeedbackDto) {
    const submission = this.feedbackRepo.create({
      userId,
      type: dto.type,
      title: dto.title.trim(),
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
    const item = await this.feedbackRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Feedback not found');
    }

    // The admin is interacting with this submission, so it's no longer "new".
    item.adminRead = true;

    if (dto.status) {
      item.status = dto.status;
    }

    if (dto.adminReply !== undefined) {
      const nextReply = dto.adminReply.trim() || null;
      // When the reply content changes (and is non-empty), surface a fresh
      // notification to the user.
      if (nextReply && nextReply !== item.adminReply) {
        item.userReplyRead = false;
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

    return this.feedbackRepo.save(item);
  }
}
