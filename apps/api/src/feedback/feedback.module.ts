import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../auth/admin.guard';
import { MailModule } from '../mail/mail.module';
import { FeedbackController } from './feedback.controller';
import { User } from '../users/user.entity';
import { FeedbackMessage } from './feedback-message.entity';
import { FeedbackSubmission } from './feedback-submission.entity';
import { FeedbackService } from './feedback.service';
import { MailInboundController } from './mail-inbound.controller';
import { MailInboundService } from './mail-inbound.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FeedbackSubmission, FeedbackMessage, User]),
    MailModule,
  ],
  controllers: [FeedbackController, MailInboundController],
  providers: [AdminGuard, FeedbackService, MailInboundService],
})
export class FeedbackModule {}
