import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes gpt-image-2 `auto` quality under-pricing (same root cause as
 * gpt-image-1, see migration 1700000000016): OpenAI renders quality="auto" at
 * high quality, so the real cost matches `high` ($0.211 at 1K), but the seeded
 * rows priced `auto` like `medium` ($0.053). gpt-image-2 rows carry a
 * resolution multiplier (1K×1, 2K×2, 4K×4), so each auto row is realigned to
 * the matching high price per resolution.
 *
 * Guarded on the old seeded value so manual admin edits and already-corrected
 * rows are left untouched. Idempotent.
 */
export class FixGptImage2AutoPricing1700000000017
  implements MigrationInterface
{
  name = 'FixGptImage2AutoPricing1700000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // auto per resolution: 0.053 -> 0.211 (1K), 0.106 -> 0.422 (2K), 0.212 -> 0.844 (4K).
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.211
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-2'
         AND "quality" = 'auto' AND "resolution" = '1K' AND "baseUsd" = 0.053`,
    );
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.422
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-2'
         AND "quality" = 'auto' AND "resolution" = '2K' AND "baseUsd" = 0.106`,
    );
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.844
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-2'
         AND "quality" = 'auto' AND "resolution" = '4K' AND "baseUsd" = 0.212`,
    );

    // Model-default safety-net row (no size/quality): 0.053 -> 0.211.
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.211
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-2'
         AND "isModelDefault" = true AND "baseUsd" = 0.053`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.053
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-2'
         AND "quality" = 'auto' AND "resolution" = '1K' AND "baseUsd" = 0.211`,
    );
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.106
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-2'
         AND "quality" = 'auto' AND "resolution" = '2K' AND "baseUsd" = 0.422`,
    );
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.212
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-2'
         AND "quality" = 'auto' AND "resolution" = '4K' AND "baseUsd" = 0.844`,
    );
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.053
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-2'
         AND "isModelDefault" = true AND "baseUsd" = 0.211`,
    );
  }
}
