import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GenerationType } from '../common/constants';
import { creditsToIls, getBillingConfig, usdToCredits } from '../config/billing';
import {
  computeVideoSellUsd,
  getModelCapability,
  normalizeVideoDuration,
} from '../common/model-capabilities';
import { AiPricingRule } from './ai-pricing-rule.entity';

export interface PricingParams {
  provider: string;
  model: string;
  size: string;
  quality?: string | null;
  resolution?: string | null;
  hasReference?: boolean;
  type?: GenerationType;
  /** Video only: clip length in seconds. */
  durationSeconds?: number | null;
  /** Video only: whether native audio is generated (v3 models). */
  generateAudio?: boolean | null;
}

export interface PricingResult {
  /** Sell price in USD (provider cost * margin). */
  usd: number;
  /** What the customer pays in shekels at the best rate. */
  priceIls: number;
  credits: number;
  ruleId: string | null;
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

    // Video is billed per second (duration × audio × margin), not by the
    // size/quality/resolution rule table. The model-default rule is still used
    // for its margin and as the audit reference (ruleId).
    if (type === GenerationType.VIDEO) {
      const video = await this.getVideoCost(params);
      if (video) return video;
    }

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
    // Sell price in USD = provider cost * margin. Credits are then derived in
    // ILS via the decoupled credit value (see config/billing.ts).
    const calculatedUsd = (rule.baseUsd + referenceUsd) * rule.margin;
    const calculatedCredits = usdToCredits(calculatedUsd);
    const hasOverride = rule.creditCostOverride !== null;
    const credits = hasOverride ? rule.creditCostOverride! : calculatedCredits;

    return {
      usd: Math.round(calculatedUsd * 10000) / 10000,
      priceIls: creditsToIls(credits),
      credits,
      ruleId: rule.id,
      usedOverride: hasOverride,
    };
  }

  /**
   * Per-second video pricing. Returns null for models without a per-second rate
   * (so the caller falls back to the standard rule lookup). The margin is taken
   * from the model-default rule when present (admin-tunable), otherwise the
   * billing default.
   */
  private async getVideoCost(
    params: PricingParams,
  ): Promise<PricingResult | null> {
    const capability = getModelCapability(params.model);
    if (!capability?.pricing.videoPerSecondUsd) return null;

    const modelDefault = await this.pricingRepo
      .createQueryBuilder('rule')
      .where('rule.type = :type', { type: GenerationType.VIDEO })
      .andWhere('rule.provider = :provider', { provider: params.provider })
      .andWhere('rule.model = :model', { model: params.model })
      .andWhere('rule.isActive = true')
      .andWhere('rule.isModelDefault = true')
      .orderBy('rule.updatedAt', 'DESC')
      .getOne();

    const duration = normalizeVideoDuration(
      params.model,
      params.durationSeconds,
    );

    // An explicit flat credit override (admin-set) wins over the per-second
    // formula, mirroring the rule-based path.
    if (modelDefault?.creditCostOverride != null) {
      const credits = modelDefault.creditCostOverride;
      return {
        usd: 0,
        priceIls: creditsToIls(credits),
        credits,
        ruleId: modelDefault.id,
        usedOverride: true,
      };
    }

    // Video uses the global target margin; the legacy per-rule margin (1.0 on
    // the original flat-priced row) does not apply to per-second pricing.
    const margin = getBillingConfig().targetMargin;
    const sellUsd = computeVideoSellUsd(
      params.model,
      duration,
      Boolean(params.generateAudio),
      margin,
    );
    if (sellUsd === null) return null;

    const credits = usdToCredits(sellUsd);
    return {
      usd: Math.round(sellUsd * 10000) / 10000,
      priceIls: creditsToIls(credits),
      credits,
      ruleId: modelDefault?.id ?? null,
      usedOverride: false,
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
