import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Re-applies the gpt-image-2 cost table after the 16:9 / 9:16 values were
 * corrected in MODEL_REGISTRY (1K/2K medium re-measured to $0.0285 / $0.0426,
 * low & high derived via the quality rule; fixes the old anomaly where 1K and
 * 2K were near-identical).
 *
 * Because migration 1700000000018 already seeded the gpt-image-2 rows and the
 * PricingSeederService only inserts-if-missing (never updates), a code change
 * alone does not reach an existing DB. As with migrations 14/18, we delete the
 * gpt-image-2 rows so the seeder re-inserts the corrected full table from
 * MODEL_REGISTRY on the next bootstrap. Idempotent and safe on a fresh DB.
 */
export class RepriceGptImage2Aspect1691700000000019
  implements MigrationInterface
{
  name = 'RepriceGptImage2Aspect1691700000000019';

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
