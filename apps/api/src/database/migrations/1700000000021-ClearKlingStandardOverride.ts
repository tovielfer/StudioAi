import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clears the legacy flat 185-credit override on the kling-v3-standard pricing
 * rule so per-second video pricing (duration × audio × margin) takes effect.
 *
 * This was originally folded into migration 1700000000020, but that migration
 * had already been recorded as run (adding the columns) before the UPDATE was
 * added, so a separate migration is needed to reach existing databases.
 */
export class ClearKlingStandardOverride1700000000021
  implements MigrationInterface
{
  name = 'ClearKlingStandardOverride1700000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "ai_pricing_rules"
      SET "creditCostOverride" = NULL
      WHERE "type" = 'video' AND "model" = 'kling-v3-standard'
    `);
  }

  public async down(): Promise<void> {
    // Non-reversible: the previous flat override was a legacy artifact.
  }
}
