import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../auth/admin.guard';
import { MailModule } from '../mail/mail.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackSubmission } from './feedback-submission.entity';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackSubmission]), MailModule],
  controllers: [FeedbackController],
  providers: [AdminGuard, FeedbackService],
})
export class FeedbackModule {}
