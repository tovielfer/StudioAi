import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes gpt-image-1 `auto` quality under-pricing. OpenAI renders quality="auto"
 * at high quality, so the real provider cost matches `high` (~$0.167 at 1:1),
 * but the seeded rows priced `auto` like `medium` ($0.04 / $0.06) — selling
 * every auto generation well below cost (flagged "בהפסד" in the admin UI).
 *
 * Aligns each existing auto row (and the model-default safety-net row) with the
 * matching `high` price. Guarded on the old value so manual admin edits and
 * already-corrected rows are left untouched. Idempotent.
 */
export class FixGptImage1AutoPricing1700000000016
  implements MigrationInterface
{
  name = 'FixGptImage1AutoPricing1700000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1:1 auto: $0.04 -> $0.167 (= high)
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.167
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-1'
         AND "size" = '1:1' AND "quality" = 'auto' AND "baseUsd" = 0.04`,
    );

    // 16:9 + 9:16 auto: $0.06 -> $0.25 (= high)
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.25
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-1'
         AND "size" IN ('16:9', '9:16') AND "quality" = 'auto' AND "baseUsd" = 0.06`,
    );

    // Model-default safety-net row (no size/quality): $0.04 -> $0.167.
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.167
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-1'
         AND "isModelDefault" = true AND "baseUsd" = 0.04`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.04
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-1'
         AND "size" = '1:1' AND "quality" = 'auto' AND "baseUsd" = 0.167`,
    );
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.06
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-1'
         AND "size" IN ('16:9', '9:16') AND "quality" = 'auto' AND "baseUsd" = 0.25`,
    );
    await queryRunner.query(
      `UPDATE "ai_pricing_rules" SET "baseUsd" = 0.04
       WHERE "provider" = 'openai' AND "model" = 'gpt-image-1'
         AND "isModelDefault" = true AND "baseUsd" = 0.167`,
    );
  }
}
