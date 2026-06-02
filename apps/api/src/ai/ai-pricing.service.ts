import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GenerationType } from '../common/constants';
import { AiPricingRule } from './ai-pricing-rule.entity';

export interface PricingParams {
  provider: string;
  model: string;
  size: string;
  quality: string;
  resolution?: string;
  hasReference?: boolean;
  type?: GenerationType;
}

export interface PricingResult {
  usd: number;
  credits: number;
  ruleId: string;
  usedOverride: boolean;
}

interface PricingLookup {
  provider: string;
  model: string;
  size: string;
  quality: string;
  resolution: string;
  type: GenerationType;
}

@Injectable()
export class AiPricingService {
  constructor(
    @InjectRepository(AiPricingRule)
    private readonly pricingRepo: Repository<AiPricingRule>,
  ) {}

  async getGenerationCost(params: PricingParams): Promise<PricingResult> {
    const type = params.type ?? GenerationType.IMAGE;
    const resolution = params.resolution ?? '1K';
    const rule = await this.findRule({
      ...params,
      type,
      resolution,
    });

    if (!rule) {
      throw new BadRequestException(
        `No active pricing rule for type=${type} provider=${params.provider} model=${params.model} size=${params.size} quality=${params.quality} resolution=${resolution}`,
      );
    }

    const referenceUsd = params.hasReference ? rule.referenceImageUsd : 0;
    const calculatedUsd = (rule.baseUsd + referenceUsd) * rule.margin;
    const calculatedCredits = Math.ceil(calculatedUsd * 100);
    const hasOverride = rule.creditCostOverride !== null;

    return {
      usd: Math.round(calculatedUsd * 10000) / 10000,
      credits: hasOverride ? rule.creditCostOverride! : calculatedCredits,
      ruleId: rule.id,
      usedOverride: hasOverride,
    };
  }

  private async findRule(params: PricingLookup) {
    const exact = await this.pricingRepo
      .createQueryBuilder('rule')
      .where('rule.type = :type', { type: params.type })
      .andWhere('rule.provider = :provider', { provider: params.provider })
      .andWhere('rule.model = :model', { model: params.model })
      .andWhere('rule.size = :size', { size: params.size })
      .andWhere('rule.quality = :quality', { quality: params.quality })
      .andWhere('rule.resolution = :resolution', { resolution: params.resolution })
      .andWhere('rule.isActive = true')
      .andWhere('rule.isModelDefault = false')
      .getOne();

    if (exact) return exact;

    const modelDefault = await this.pricingRepo
      .createQueryBuilder('rule')
      .where('rule.type = :type', { type: params.type })
      .andWhere('rule.provider = :provider', { provider: params.provider })
      .andWhere('rule.model = :model', { model: params.model })
      .andWhere('rule.isActive = true')
      .andWhere('rule.isModelDefault = true')
      .orderBy('rule.updatedAt', 'DESC')
      .getOne();

    if (modelDefault) return modelDefault;

    return this.pricingRepo
      .createQueryBuilder('rule')
      .where('rule.type = :type', { type: params.type })
      .andWhere('rule.provider IS NULL')
      .andWhere('rule.model IS NULL')
      .andWhere('rule.isActive = true')
      .andWhere('rule.isModelDefault = true')
      .orderBy('rule.updatedAt', 'DESC')
      .getOne();
  }
}
