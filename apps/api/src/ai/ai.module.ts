import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiPricingRule } from './ai-pricing-rule.entity';
import { AiPricingService } from './ai-pricing.service';
import { AiService } from './ai.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiPricingRule])],
  providers: [AiService, AiPricingService],
  exports: [AiService, AiPricingService],
})
export class AiModule {}
