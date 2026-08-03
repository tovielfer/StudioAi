import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the gpt-image-2 pricing rows with the measured per-aspect-ratio ×
 * resolution × quality cost table now defined in MODEL_REGISTRY.
 *
 * The previous rows used a flat base × uniform 4K=×4 estimate that ignored the
 * aspect ratio entirely. Because gpt-image-2 is billed by output tokens, narrow
 * ratios are far cheaper than the square, so that estimate badly over-charged
 * them (e.g. 9:21 4K high really costs $0.2459 but was priced as $0.844 ⇒ 625
 * credits / ₪6.25 instead of ~182 credits / ₪1.82).
 *
 * Strategy mirrors migration 1700000000014: delete the gpt-image-2 rows so the
 * PricingSeederService re-inserts the corrected full table from MODEL_REGISTRY
 * on the next bootstrap (insert-if-missing). Idempotent and safe on a DB that
 * has no such rows yet.
 */
export class RepriceGptImage2RealCosts1700000000018
  implements MigrationInterface
{
  name = 'RepriceGptImage2RealCosts1700000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "ai_pricing_rules" WHERE "provider" = 'openai' AND "model" = 'gpt-image-2'`,
    );
  }

  public async down(): Promise<void> {
    // Non-reversible data realignment; the seeder repopulates gpt-image-2 rows
    // from MODEL_REGISTRY on the next bootstrap.
  }
}
