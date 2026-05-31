import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferenceImageUrls1700000000003 implements MigrationInterface {
  name = 'AddReferenceImageUrls1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      ADD COLUMN IF NOT EXISTS "referenceImageUrls" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      DROP COLUMN IF EXISTS "referenceImageUrls"
    `);
  }
}
