import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropReferenceImageUrl1700000000004 implements MigrationInterface {
  name = 'DropReferenceImageUrl1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Backfill: copy any single referenceImageUrl into referenceImageUrls where array is missing
    await queryRunner.query(`
      UPDATE "generations"
      SET "referenceImageUrls" = jsonb_build_array("referenceImageUrl")
      WHERE "referenceImageUrl" IS NOT NULL
        AND ("referenceImageUrls" IS NULL OR jsonb_array_length("referenceImageUrls") = 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "generations"
      DROP COLUMN IF EXISTS "referenceImageUrl"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      ADD COLUMN IF NOT EXISTS "referenceImageUrl" character varying NULL
    `);

    // Restore from first element of referenceImageUrls
    await queryRunner.query(`
      UPDATE "generations"
      SET "referenceImageUrl" = "referenceImageUrls"->>0
      WHERE "referenceImageUrls" IS NOT NULL
        AND jsonb_array_length("referenceImageUrls") > 0
    `);
  }
}
