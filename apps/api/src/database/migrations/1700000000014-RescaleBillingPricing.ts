import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns existing pricing rules with the redesigned billing model:
 *  - Uniform margin 2.0 (was 2.5).
 *  - Removes the broken gpt-image-2 rows (baseUsd inflated by the ×8 4K
 *    multiplier, up to $1.76). The PricingSeederService re-inserts correct rows
 *    from MODEL_REGISTRY (high $0.211, resolution ×1/×2/×4) on next bootstrap.
 *  - Rescales flat credit overrides to the new credit unit (credit = ILS 0.01):
 *    Kling video 50 -> 185, upscale 10 -> 37.
 * Idempotent: safe to run on a DB that has none of these rows.
 */
export class RescaleBillingPricing1700000000014 implements MigrationInterface {
  name = 'RescaleBillingPricing1700000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "margin" = 2.0 WHERE "margin" = 2.5`,
    );

    await queryRunner.query(
      `DELETE FROM "ai_pricing_rules" WHERE "provider" = 'openai' AND "model" = 'gpt-image-2'`,
    );

    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "creditCostOverride" = 185 WHERE "model" = 'kling-v3-standard' AND "creditCostOverride" = 50`,
    );

    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "creditCostOverride" = 37 WHERE "type" = 'upscale' AND "creditCostOverride" = 10`,
    );
  }

  public async down(): Promise<void> {
    // Non-reversible data realignment; the seeder repopulates gpt-image-2 rows.
  }
}
