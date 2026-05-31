import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeedbackReplyStatus1700000000006 implements MigrationInterface {
  name = 'AddFeedbackReplyStatus1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      ADD COLUMN IF NOT EXISTS "status" character varying NOT NULL DEFAULT 'open'
    `);

    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      ADD COLUMN IF NOT EXISTS "adminReply" text
    `);

    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      ADD COLUMN IF NOT EXISTS "answeredAt" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      DROP COLUMN IF EXISTS "answeredAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      DROP COLUMN IF EXISTS "adminReply"
    `);

    await queryRunner.query(`
      ALTER TABLE "feedback_submissions"
      DROP COLUMN IF EXISTS "status"
    `);
  }
}
