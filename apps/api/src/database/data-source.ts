import { DataSource } from 'typeorm';
import { join } from 'path';
import '../config/env.loader';
import { User } from '../users/user.entity';
import { Generation } from '../generations/generation.entity';
import { CreditTransaction } from '../credits/credit-transaction.entity';
import { FeedbackSubmission } from '../feedback/feedback-submission.entity';
import { FeedbackMessage } from '../feedback/feedback-message.entity';
import { AiPricingRule } from '../ai/ai-pricing-rule.entity';
import { AiPricingRuleAuditLog } from '../ai/ai-pricing-rule-audit-log.entity';
import { CreditPackage } from '../billing/credit-package.entity';
import { Order } from '../billing/order.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    Generation,
    CreditTransaction,
    FeedbackSubmission,
    FeedbackMessage,
    AiPricingRule,
    AiPricingRuleAuditLog,
    CreditPackage,
    Order,
  ],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
});
