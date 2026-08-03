import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Google does not accept a `quality` parameter, and only the Pro image model
 * honours resolution tiers. This migration:
 *  - makes generations.quality/resolution nullable,
 *  - deactivates the now-redundant per-quality/size Google pricing rows,
 *  - adds resolution-only pricing rows for the Pro model (size/quality NULL),
 *  - backfills historical Google generations to NULL out the dead values.
 */

const PRO_MODEL = 'gemini-3-pro-image';
const PRO_BASE_USD = 0.134;
const REFERENCE_IMAGE_USD = 0.005;
const MARGIN = 2.5;
const PRO_RESOLUTION_MULTIPLIER: Record<string, number> = {
  '1K': 1,
  '2K': 1,
  '4K': 1.79,
};

export class CleanupGooglePricing1700000000012
  implements MigrationInterface
{
  name = 'CleanupGooglePricing1700000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Allow NULL quality/resolution on generations.
    await queryRunner.query(`
      ALTER TABLE "generations" ALTER COLUMN "quality" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "generations" ALTER COLUMN "quality" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "generations" ALTER COLUMN "resolution" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "generations" ALTER COLUMN "resolution" DROP DEFAULT
    `);

    // 2. Deactivate the redundant detailed Google pricing rows (fast/standard/hd
    //    and the old per-size/resolution combos). Model-default rows stay active.
    await queryRunner.query(`
      UPDATE "ai_pricing_rules"
      SET "isActive" = false
      WHERE "provider" = 'google' AND "isModelDefault" = false
    `);

    // 3. Add resolution-only pricing rows for the Pro model (ignores quality/size).
    for (const [resolution, multiplier] of Object.entries(
      PRO_RESOLUTION_MULTIPLIER,
    )) {
      await this.insertProResolutionRule(
        queryRunner,
        resolution,
        PRO_BASE_USD * multiplier,
      );
    }

    // 4. Backfill historical Google generations.
    await queryRunner.query(`
      UPDATE "generations" SET "quality" = NULL WHERE "provider" = 'google'
    `);
    await queryRunner.query(`
      UPDATE "generations"
      SET "resolution" = NULL
      WHERE "provider" = 'google' AND "model" NOT LIKE '%3-pro%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the resolution-only Pro rows.
    await queryRunner.query(`
      DELETE FROM "ai_pricing_rules"
      WHERE "provider" = 'google'
        AND "model" = $1
        AND "size" IS NULL
        AND "quality" IS NULL
        AND "isModelDefault" = false
    `, [PRO_MODEL]);

    // Reactivate the previously-deactivated detailed Google rows.
    await queryRunner.query(`
      UPDATE "ai_pricing_rules"
      SET "isActive" = true
      WHERE "provider" = 'google' AND "isModelDefault" = false
    `);

    // Restore non-null defaults before re-adding the NOT NULL constraints.
    await queryRunner.query(`
      UPDATE "generations" SET "quality" = 'standard' WHERE "quality" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "generations" SET "resolution" = '1K' WHERE "resolution" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "generations" ALTER COLUMN "quality" SET DEFAULT 'standard'
    `);
    await queryRunner.query(`
      ALTER TABLE "generations" ALTER COLUMN "quality" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "generations" ALTER COLUMN "resolution" SET DEFAULT '1K'
    `);
    await queryRunner.query(`
      ALTER TABLE "generations" ALTER COLUMN "resolution" SET NOT NULL
    `);
  }

  private async insertProResolutionRule(
    queryRunner: QueryRunner,
    resolution: string,
    baseUsd: number,
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
          'image',
          'google',
          $1::varchar,
          NULL,
          NULL,
          $2::varchar,
          $3::numeric,
          $4::numeric,
          $5::numeric,
          NULL,
          false,
          true
        WHERE NOT EXISTS (
          SELECT 1
          FROM "ai_pricing_rules"
          WHERE "type" = 'image'
            AND "provider" = 'google'
            AND "model" = $1::varchar
            AND "size" IS NULL
            AND "quality" IS NULL
            AND "resolution" IS NOT DISTINCT FROM $2::varchar
            AND "isModelDefault" = false
        )
      `,
      [PRO_MODEL, resolution, baseUsd, REFERENCE_IMAGE_USD, MARGIN],
    );
  }
}
