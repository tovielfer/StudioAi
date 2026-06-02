import { MigrationInterface, QueryRunner } from 'typeorm';

type RuleSeed = {
  type: string;
  provider: string | null;
  model: string | null;
  size: string | null;
  quality: string | null;
  resolution: string | null;
  baseUsd: number;
  referenceImageUsd: number;
  margin: number;
  creditCostOverride: number | null;
  isModelDefault: boolean;
  isActive: boolean;
};

const MARGIN = 2.5;
const REFERENCE_IMAGE_USD = 0.005;
const SIZES = ['1:1', '16:9', '9:16', '4:3'];
const QUALITIES = ['fast', 'standard', 'hd'];
const RESOLUTIONS = ['1K', '2K', '4K'];

const IMAGE_COST_TABLE: Record<
  string,
  Record<string, Record<string, Record<string, number>>>
> = {
  openai: {
    'gpt-image-1': {
      '1:1': { fast: 0.011, standard: 0.04, hd: 0.167 },
      '16:9': { fast: 0.016, standard: 0.06, hd: 0.25 },
      '9:16': { fast: 0.016, standard: 0.06, hd: 0.25 },
      '4:3': { fast: 0.016, standard: 0.06, hd: 0.25 },
    },
    'gpt-image-2': {
      '1:1': { fast: 0.015, standard: 0.05, hd: 0.22 },
      '16:9': { fast: 0.015, standard: 0.05, hd: 0.22 },
      '9:16': { fast: 0.015, standard: 0.05, hd: 0.22 },
      '4:3': { fast: 0.015, standard: 0.05, hd: 0.22 },
    },
  },
  replicate: {
    'flux-dev': {
      '1:1': { fast: 0.025, standard: 0.032, hd: 0.05 },
      '16:9': { fast: 0.03, standard: 0.038, hd: 0.06 },
      '9:16': { fast: 0.03, standard: 0.038, hd: 0.06 },
      '4:3': { fast: 0.03, standard: 0.038, hd: 0.06 },
    },
    'flux-schnell': {
      '1:1': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '16:9': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '9:16': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '4:3': { fast: 0.003, standard: 0.003, hd: 0.003 },
    },
    'black-forest-labs/flux-schnell': {
      '1:1': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '16:9': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '9:16': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '4:3': { fast: 0.003, standard: 0.003, hd: 0.003 },
    },
  },
  fal: {
    'flux-schnell': {
      '1:1': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '16:9': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '9:16': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '4:3': { fast: 0.003, standard: 0.003, hd: 0.003 },
    },
    'fal-flux': {
      '1:1': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '16:9': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '9:16': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '4:3': { fast: 0.003, standard: 0.003, hd: 0.003 },
    },
  },
  stability: {
    sd3: {
      '1:1': { fast: 0.035, standard: 0.065, hd: 0.065 },
      '16:9': { fast: 0.035, standard: 0.065, hd: 0.065 },
      '9:16': { fast: 0.035, standard: 0.065, hd: 0.065 },
      '4:3': { fast: 0.035, standard: 0.065, hd: 0.065 },
    },
  },
  google: {
    'gemini-3-pro-image-preview': {
      '1:1': { fast: 0.134, standard: 0.134, hd: 0.134 },
      '16:9': { fast: 0.134, standard: 0.134, hd: 0.134 },
      '9:16': { fast: 0.134, standard: 0.134, hd: 0.134 },
      '4:3': { fast: 0.134, standard: 0.134, hd: 0.134 },
    },
    'gemini-3.1-flash-image': {
      '1:1': { fast: 0.0672, standard: 0.0672, hd: 0.0672 },
      '16:9': { fast: 0.0672, standard: 0.0672, hd: 0.0672 },
      '9:16': { fast: 0.0672, standard: 0.0672, hd: 0.0672 },
      '4:3': { fast: 0.0672, standard: 0.0672, hd: 0.0672 },
    },
    'gemini-2.5-flash-image': {
      '1:1': { fast: 0.039, standard: 0.039, hd: 0.039 },
      '16:9': { fast: 0.039, standard: 0.039, hd: 0.039 },
      '9:16': { fast: 0.039, standard: 0.039, hd: 0.039 },
      '4:3': { fast: 0.039, standard: 0.039, hd: 0.039 },
    },
  },
  mock: {
    default: {
      '1:1': { fast: 0, standard: 0, hd: 0 },
      '16:9': { fast: 0, standard: 0, hd: 0 },
      '9:16': { fast: 0, standard: 0, hd: 0 },
      '4:3': { fast: 0, standard: 0, hd: 0 },
    },
  },
};

const RESOLUTION_MULTIPLIER: Record<string, Record<string, Record<string, number>>> = {
  google: {
    'gemini-3-pro-image-preview': { '1K': 1, '2K': 1, '4K': 1.79 },
  },
  openai: {
    'gpt-image-2': { '1K': 1, '2K': 4, '4K': 8 },
  },
};

function imageRules(): RuleSeed[] {
  const rules: RuleSeed[] = [];

  for (const [provider, models] of Object.entries(IMAGE_COST_TABLE)) {
    for (const [model, sizes] of Object.entries(models)) {
      const modelResolutions = RESOLUTION_MULTIPLIER[provider]?.[model]
        ? RESOLUTIONS
        : ['1K'];

      for (const size of SIZES) {
        for (const quality of QUALITIES) {
          const base = sizes[size]?.[quality];
          if (base === undefined) continue;

          for (const resolution of modelResolutions) {
            rules.push({
              type: 'image',
              provider,
              model,
              size,
              quality,
              resolution,
              baseUsd:
                base *
                (RESOLUTION_MULTIPLIER[provider]?.[model]?.[resolution] ?? 1),
              referenceImageUsd: REFERENCE_IMAGE_USD,
              margin: MARGIN,
              creditCostOverride: null,
              isModelDefault: false,
              isActive: true,
            });
          }
        }
      }

      rules.push({
        type: 'image',
        provider,
        model,
        size: null,
        quality: null,
        resolution: null,
        baseUsd: sizes['1:1']?.standard ?? 0,
        referenceImageUsd: REFERENCE_IMAGE_USD,
        margin: MARGIN,
        creditCostOverride: null,
        isModelDefault: true,
        isActive: true,
      });
    }
  }

  return rules;
}

const FLAT_RULES: RuleSeed[] = [
  {
    type: 'video',
    provider: 'fal',
    model: 'kling-v3-standard',
    size: null,
    quality: null,
    resolution: null,
    baseUsd: 0,
    referenceImageUsd: 0,
    margin: 1,
    creditCostOverride: 50,
    isModelDefault: true,
    isActive: true,
  },
  {
    type: 'upscale',
    provider: null,
    model: null,
    size: null,
    quality: null,
    resolution: null,
    baseUsd: 0,
    referenceImageUsd: 0,
    margin: 1,
    creditCostOverride: 10,
    isModelDefault: true,
    isActive: true,
  },
];

export class CreateAiPricingRules1700000000009
  implements MigrationInterface
{
  name = 'CreateAiPricingRules1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_pricing_rules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" character varying NOT NULL DEFAULT 'image',
        "provider" character varying,
        "model" character varying,
        "size" character varying,
        "quality" character varying,
        "resolution" character varying,
        "baseUsd" numeric(12,6) NOT NULL DEFAULT 0,
        "referenceImageUsd" numeric(12,6) NOT NULL DEFAULT 0,
        "margin" numeric(8,4) NOT NULL DEFAULT 1,
        "creditCostOverride" integer,
        "isModelDefault" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_pricing_rules" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_pricing_rules_unique_lookup"
      ON "ai_pricing_rules" (
        "type",
        COALESCE("provider", ''),
        COALESCE("model", ''),
        COALESCE("size", ''),
        COALESCE("quality", ''),
        COALESCE("resolution", ''),
        "isModelDefault"
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_pricing_rule_audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ruleId" uuid NOT NULL,
        "adminUserId" uuid,
        "field" character varying NOT NULL,
        "oldValue" text,
        "newValue" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_pricing_rule_audit_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_pricing_rule_audit_logs_rule"
      ON "ai_pricing_rule_audit_logs" ("ruleId", "createdAt")
    `);

    await queryRunner.query(`
      ALTER TABLE "generations"
      ADD COLUMN IF NOT EXISTS "pricingRuleId" uuid
    `);

    for (const rule of [...imageRules(), ...FLAT_RULES]) {
      await this.insertRule(queryRunner, rule);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      DROP COLUMN IF EXISTS "pricingRuleId"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_pricing_rule_audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_pricing_rules"`);
  }

  private async insertRule(
    queryRunner: QueryRunner,
    rule: RuleSeed,
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO "ai_pricing_rules" (
          "type",
          "provider",
          "model",
          "size",
          "quality",
          "resolution",
          "baseUsd",
          "referenceImageUsd",
          "margin",
          "creditCostOverride",
          "isModelDefault",
          "isActive"
        )
        SELECT
          $1::varchar,
          $2::varchar,
          $3::varchar,
          $4::varchar,
          $5::varchar,
          $6::varchar,
          $7::numeric,
          $8::numeric,
          $9::numeric,
          $10::integer,
          $11::boolean,
          $12::boolean
        WHERE NOT EXISTS (
          SELECT 1
          FROM "ai_pricing_rules"
          WHERE "type" = $1::varchar
            AND "provider" IS NOT DISTINCT FROM $2::varchar
            AND "model" IS NOT DISTINCT FROM $3::varchar
            AND "size" IS NOT DISTINCT FROM $4::varchar
            AND "quality" IS NOT DISTINCT FROM $5::varchar
            AND "resolution" IS NOT DISTINCT FROM $6::varchar
            AND "isModelDefault" = $11::boolean
        )
      `,
      [
        rule.type,
        rule.provider,
        rule.model,
        rule.size,
        rule.quality,
        rule.resolution,
        rule.baseUsd,
        rule.referenceImageUsd,
        rule.margin,
        rule.creditCostOverride,
        rule.isModelDefault,
        rule.isActive,
      ],
    );
  }
}
