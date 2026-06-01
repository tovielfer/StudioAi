import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResolution1700000000008 implements MigrationInterface {
  name = 'AddResolution1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      ADD COLUMN IF NOT EXISTS "resolution" varchar NOT NULL DEFAULT '1K'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      DROP COLUMN IF EXISTS "resolution"
    `);
  }
}
