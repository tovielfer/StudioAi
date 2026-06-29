import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminGuard } from '../auth/admin.guard';
import { CreditsModule } from '../credits/credits.module';
import { UsersModule } from '../users/users.module';
import {
  AdminBillingController,
  BillingController,
} from './billing.controller';
import { BillingService } from './billing.service';
import { CreditPackage } from './credit-package.entity';
import { Order } from './order.entity';
import { SavedPaymentMethod } from './saved-payment-method.entity';
import { SumitService } from './sumit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreditPackage, Order, SavedPaymentMethod]),
    CreditsModule,
    UsersModule,
  ],
  controllers: [BillingController, AdminBillingController],
  providers: [BillingService, SumitService, AdminGuard],
  exports: [BillingService],
})
export class BillingModule {}
