import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeedbackReadFlags1700000000007 implements MigrationInterface {
  name = 'AddFeedbackReadFlags1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      ADD COLUMN IF NOT EXISTS "userReplyRead" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      ADD COLUMN IF NOT EXISTS "adminRead" boolean NOT NULL DEFAULT false
    `);

    // Existing submissions that already have a reply are considered read by the
    // user (we don't want to surface stale notifications on first deploy).
    await queryRunner.query(`
      UPDATE "feedback_submissions"
      SET "userReplyRead" = true
      WHERE "adminReply" IS NOT NULL
    `);

    // Existing submissions are treated as already seen by the admin.
    await queryRunner.query(`
      UPDATE "feedback_submissions"
      SET "adminRead" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      DROP COLUMN IF EXISTS "adminRead"
    `);

    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      DROP COLUMN IF EXISTS "userReplyRead"
    `);
  }
}
