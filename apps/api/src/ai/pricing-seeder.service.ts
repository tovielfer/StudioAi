import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProvider, GenerationType } from '../common/constants';
import { getBillingConfig } from '../config/billing';
import {
  MODEL_REGISTRY,
  ModelCapability,
} from '../common/model-capabilities';
import { AiPricingRule } from './ai-pricing-rule.entity';

const DEFAULT_REFERENCE_IMAGE_USD = 0.005;

interface DesiredRule {
  type: GenerationType;
  provider: AiProvider;
  model: string;
  size: string | null;
  quality: string | null;
  resolution: string | null;
  baseUsd: number;
  referenceImageUsd: number;
  margin: number;
  creditCostOverride: number | null;
  isModelDefault: boolean;
}

/**
 * Derives pricing rules from {@link MODEL_REGISTRY} and inserts the ones that do
 * not exist yet (insert-if-missing) on application bootstrap. This guarantees
 * every registered model has at least a model-default price, so a new model (or
 * a new size such as 21:9) is priced immediately instead of crashing with
 * "No active pricing rule".
 *
 * It never updates or deletes rows, so admin edits and existing seeded rows are
 * always preserved. On an up-to-date DB it inserts nothing.
 */
@Injectable()
export class PricingSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PricingSeederService.name);

  constructor(
    @InjectRepository(AiPricingRule)
    private readonly pricingRepo: Repository<AiPricingRule>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seed();
      await this.validate();
    } catch (err) {
      this.logger.error(
        `Pricing seeding failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async seed(): Promise<void> {
    const desired = MODEL_REGISTRY.flatMap((model) => this.rulesForModel(model));

    // Load every existing rule once and index it by its lookup key, instead of
    // issuing one EXISTS query per desired rule (N+1).
    const existing = await this.pricingRepo.find({
      select: [
        'type',
        'provider',
        'model',
        'size',
        'quality',
        'resolution',
        'isModelDefault',
      ],
    });
    const existingKeys = new Set(existing.map((rule) => this.lookupKey(rule)));

    const toInsert = desired.filter(
      (rule) => !existingKeys.has(this.lookupKey(rule)),
    );

    let inserted = 0;
    if (toInsert.length > 0) {
      // orIgnore guards against a race when multiple instances boot together;
      // the unique lookup index turns a duplicate into a no-op.
      const result = await this.pricingRepo
        .createQueryBuilder()
        .insert()
        .values(toInsert.map((rule) => this.toEntity(rule)))
        .orIgnore()
        .execute();
      inserted = result.identifiers.filter(Boolean).length || toInsert.length;
    }

    this.logger.log(
      inserted > 0
        ? `Pricing seeder inserted ${inserted} missing rule(s)`
        : 'Pricing seeder: all model rules already present',
    );
  }

  private async validate(): Promise<void> {
    // Load all active rules once and index by model identity (type|provider|model).
    const activeRules = await this.pricingRepo.find({
      where: { isActive: true },
      select: ['type', 'provider', 'model'],
    });
    const activeModelKeys = new Set(
      activeRules.map(
        (rule) => `${rule.type}|${rule.provider}|${rule.model}`,
      ),
    );

    for (const model of MODEL_REGISTRY) {
      const key = `${model.type}|${model.provider}|${model.id}`;
      if (!activeModelKeys.has(key)) {
        this.logger.warn(
          `Model "${model.id}" (${model.provider}) has no active pricing rule`,
        );
      }
    }
  }

  /**
   * Composite key matching the unique lookup index: identifies a rule by its
   * full discriminator so existence checks can be done in memory. `null` is
   * encoded distinctly from an empty string to avoid collisions.
   */
  private lookupKey(rule: {
    type: GenerationType;
    provider: AiProvider | null;
    model: string | null;
    size: string | null;
    quality: string | null;
    resolution: string | null;
    isModelDefault: boolean;
  }): string {
    const part = (value: string | null) => (value === null ? '\u0000' : value);
    return [
      rule.type,
      part(rule.provider),
      part(rule.model),
      part(rule.size),
      part(rule.quality),
      part(rule.resolution),
      rule.isModelDefault ? '1' : '0',
    ].join('|');
  }

  private rulesForModel(model: ModelCapability): DesiredRule[] {
    const { pricing } = model;
    const margin = pricing.margin ?? getBillingConfig().targetMargin;
    const referenceImageUsd =
      pricing.referenceImageUsd ?? DEFAULT_REFERENCE_IMAGE_USD;
    const creditCostOverride = pricing.creditCostOverride ?? null;

    const base = (
      overrides: Partial<DesiredRule> & Pick<DesiredRule, 'baseUsd'>,
    ): DesiredRule => ({
      type: model.type,
      provider: model.provider,
      model: model.id,
      size: null,
      quality: null,
      resolution: null,
      referenceImageUsd,
      margin,
      creditCostOverride,
      isModelDefault: false,
      ...overrides,
    });

    const rules: DesiredRule[] = [
      // Always: the model-default safety-net row.
      base({ baseUsd: pricing.baseUsd, isModelDefault: true }),
    ];

    if (pricing.perSizeResolutionQuality) {
      // Full measured table: one row per size × resolution × quality, using the
      // exact cost (no multiplier). Takes precedence over the legacy shapes.
      for (const [size, byResolution] of Object.entries(
        pricing.perSizeResolutionQuality,
      )) {
        for (const [resolution, byQuality] of Object.entries(byResolution)) {
          for (const [quality, baseUsd] of Object.entries(byQuality)) {
            rules.push(base({ size, quality, resolution, baseUsd }));
          }
        }
      }
    } else if (pricing.perSizeQuality) {
      const resolutions = pricing.resolutionMultiplier
        ? Object.keys(pricing.resolutionMultiplier)
        : model.resolutions.length
          ? model.resolutions.map((r) => r.id)
          : ['1K'];

      for (const size of model.sizes.map((s) => s.id)) {
        const byQuality = pricing.perSizeQuality[size];
        if (!byQuality) continue;
        for (const [quality, sizeQualityUsd] of Object.entries(byQuality)) {
          for (const resolution of resolutions) {
            const multiplier =
              pricing.resolutionMultiplier?.[resolution] ?? 1;
            rules.push(
              base({
                size,
                quality,
                resolution,
                baseUsd: sizeQualityUsd * multiplier,
              }),
            );
          }
        }
      }
    } else if (pricing.resolutionMultiplier) {
      // Resolution-only pricing (e.g. Google Pro): size/quality ignored.
      for (const [resolution, multiplier] of Object.entries(
        pricing.resolutionMultiplier,
      )) {
        rules.push(
          base({ resolution, baseUsd: pricing.baseUsd * multiplier }),
        );
      }
    }

    return rules;
  }

  private toEntity(rule: DesiredRule): Partial<AiPricingRule> {
    return {
      type: rule.type,
      provider: rule.provider,
      model: rule.model,
      size: rule.size as AiPricingRule['size'],
      quality: rule.quality as AiPricingRule['quality'],
      resolution: rule.resolution as AiPricingRule['resolution'],
      baseUsd: rule.baseUsd,
      referenceImageUsd: rule.referenceImageUsd,
      margin: rule.margin,
      creditCostOverride: rule.creditCostOverride,
      isModelDefault: rule.isModelDefault,
      isActive: true,
    };
  }
}
