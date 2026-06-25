import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the per-generation video controls: clip length (`durationSeconds`) and
 * the native-audio flag (`generateAudio`). Both are nullable — they only apply
 * to video generations, and existing rows stay NULL (treated as 5s / no audio
 * by the provider defaults).
 */
export class AddVideoDurationAndAudio1700000000020
  implements MigrationInterface
{
  name = 'AddVideoDurationAndAudio1700000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      ADD COLUMN IF NOT EXISTS "durationSeconds" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "generations"
      ADD COLUMN IF NOT EXISTS "generateAudio" boolean
    `);

    // Kling video moved from a flat 185-credit override to per-second pricing
    // (duration × audio × margin). Clear the legacy override so the dynamic
    // formula applies; admins can re-set an override later if desired.
    await queryRunner.query(`
      UPDATE "ai_pricing_rules"
      SET "creditCostOverride" = NULL
      WHERE "type" = 'video' AND "model" = 'kling-v3-standard'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      DROP COLUMN IF EXISTS "generateAudio"
    `);
    await queryRunner.query(`
      ALTER TABLE "generations"
      DROP COLUMN IF EXISTS "durationSeconds"
    `);
  }
}
