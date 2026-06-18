import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GenerationType } from '../common/constants';
import { AiPricingRule } from './ai-pricing-rule.entity';

export interface PricingParams {
  provider: string;
  model: string;
  size: string;
  quality?: string | null;
  resolution?: string | null;
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
  quality: string | null;
  resolution: string | null;
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
    const quality = params.quality ?? null;
    const resolution = params.resolution ?? null;
    const rule = await this.findRule({
      ...params,
      type,
      quality,
      resolution,
    });

    if (!rule) {
      throw new BadRequestException(
        `No active pricing rule for type=${type} provider=${params.provider} model=${params.model} size=${params.size} quality=${quality} resolution=${resolution}`,
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
    // Tier 1: fully-specified exact match (used by providers that honour
    // size/quality/resolution, e.g. OpenAI). Skipped when quality/resolution
    // were stripped (null) so we don't try to match `= NULL`.
    if (params.quality !== null && params.resolution !== null) {
      const exact = await this.pricingRepo
        .createQueryBuilder('rule')
        .where('rule.type = :type', { type: params.type })
        .andWhere('rule.provider = :provider', { provider: params.provider })
        .andWhere('rule.model = :model', { model: params.model })
        .andWhere('rule.size = :size', { size: params.size })
        .andWhere('rule.quality = :quality', { quality: params.quality })
        .andWhere('rule.resolution = :resolution', {
          resolution: params.resolution,
        })
        .andWhere('rule.isActive = true')
        .andWhere('rule.isModelDefault = false')
        .getOne();

      if (exact) return exact;
    }

    // Tier 2: resolution-only match for models that price by resolution but
    // ignore quality/size (e.g. Google Pro). Rows have size/quality NULL.
    if (params.resolution !== null) {
      const byResolution = await this.pricingRepo
        .createQueryBuilder('rule')
        .where('rule.type = :type', { type: params.type })
        .andWhere('rule.provider = :provider', { provider: params.provider })
        .andWhere('rule.model = :model', { model: params.model })
        .andWhere('rule.size IS NULL')
        .andWhere('rule.quality IS NULL')
        .andWhere('rule.resolution = :resolution', {
          resolution: params.resolution,
        })
        .andWhere('rule.isActive = true')
        .andWhere('rule.isModelDefault = false')
        .getOne();

      if (byResolution) return byResolution;
    }

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
