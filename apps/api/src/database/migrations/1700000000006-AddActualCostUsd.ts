import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActualCostUsd1700000000006 implements MigrationInterface {
  name = 'AddActualCostUsd1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      ADD COLUMN IF NOT EXISTS "actualCostUsd" numeric(12,6) DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      DROP COLUMN IF EXISTS "actualCostUsd"
    `);
  }
}
