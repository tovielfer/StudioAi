import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserBlockingAndPublicFeedback1783000000001
  implements MigrationInterface
{
  name = 'AddUserBlockingAndPublicFeedback1783000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "isBlocked" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      ALTER COLUMN "userId" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      ADD COLUMN IF NOT EXISTS "contactEmail" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      DROP COLUMN IF EXISTS "contactEmail"
    `);

    await queryRunner.query(`
      DELETE FROM "feedback_submissions"
      WHERE "userId" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      ALTER COLUMN "userId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "isBlocked"
    `);
  }
}
