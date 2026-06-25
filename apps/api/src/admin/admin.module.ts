import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiPricingRuleAuditLog } from '../ai/ai-pricing-rule-audit-log.entity';
import { AiPricingRule } from '../ai/ai-pricing-rule.entity';
import { AdminGuard } from '../auth/admin.guard';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { CreditsModule } from '../credits/credits.module';
import { Generation } from '../generations/generation.entity';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/user.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Generation,
      CreditTransaction,
      AiPricingRule,
      AiPricingRuleAuditLog,
    ]),
    CreditsModule,
    MailModule,
  ],
  controllers: [AdminController],
  providers: [AdminGuard, AdminService],
})
export class AdminModule {}
