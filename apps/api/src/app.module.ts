import { Module, DynamicModule, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GenerationsModule } from './generations/generations.module';
import { CreditsModule } from './credits/credits.module';
import { StorageModule } from './storage/storage.module';
import { AiModule } from './ai/ai.module';
import { UploadsModule } from './uploads/uploads.module';
import { AdminModule } from './admin/admin.module';
import { FeedbackModule } from './feedback/feedback.module';
import { BillingModule } from './billing/billing.module';
import { HealthController } from './health.controller';
import { LoggerMiddleware } from './common/logger.middleware';
import { User } from './users/user.entity';
import { Generation } from './generations/generation.entity';
import { CreditTransaction } from './credits/credit-transaction.entity';
import { FeedbackSubmission } from './feedback/feedback-submission.entity';
import { AiPricingRule } from './ai/ai-pricing-rule.entity';
import { AiPricingRuleAuditLog } from './ai/ai-pricing-rule-audit-log.entity';
import { CreditPackage } from './billing/credit-package.entity';
import { Order } from './billing/order.entity';
import { SavedPaymentMethod } from './billing/saved-payment-method.entity';
import { isSyncQueue } from './config/env.loader';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }

  static register(): DynamicModule {
    const sync = isSyncQueue();

    const coreImports: DynamicModule['imports'] = [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: [
          join(process.cwd(), '.env'),
          join(process.cwd(), '../../.env'),
        ],
      }),
      TypeOrmModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          type: 'postgres',
          url: config.get<string>('DATABASE_URL'),
          entities: [
            User,
            Generation,
            CreditTransaction,
            FeedbackSubmission,
            AiPricingRule,
            AiPricingRuleAuditLog,
            CreditPackage,
            Order,
            SavedPaymentMethod,
          ],
          migrations: [join(__dirname, 'database/migrations/*.{ts,js}')],
          migrationsRun: true,
          synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
          logging: false,
        }),
      }),
    ];

    const queueImports: DynamicModule['imports'] = sync
      ? []
      : [
          BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              connection: {
                url: config.get('REDIS_URL', 'redis://localhost:6379'),
              },
            }),
          }),
        ];

    const featureImports: DynamicModule['imports'] = [
      AuthModule,
      UsersModule,
      GenerationsModule.register(sync),
      CreditsModule,
      StorageModule,
      AiModule,
      UploadsModule,
      AdminModule,
      FeedbackModule,
      BillingModule,
    ];

    return {
      module: AppModule,
      imports: [...coreImports, ...queueImports, ...featureImports],
      controllers: [HealthController],
    };
  }
}
