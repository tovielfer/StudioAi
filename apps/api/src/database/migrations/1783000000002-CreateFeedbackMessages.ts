import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeedbackMessages1783000000002 implements MigrationInterface {
  name = 'CreateFeedbackMessages1783000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Thread messages table.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feedback_messages" (
        "id"             uuid              NOT NULL DEFAULT gen_random_uuid(),
        "feedbackId"     uuid              NOT NULL,
        "direction"      character varying NOT NULL,
        "authorType"     character varying NOT NULL,
        "body"           text              NOT NULL,
        "emailMessageId" character varying,
        "attachments"    jsonb,
        "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feedback_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_feedback_messages_feedback"
          FOREIGN KEY ("feedbackId") REFERENCES "feedback_submissions"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_feedback_messages_feedbackId"
      ON "feedback_messages" ("feedbackId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_feedback_messages_createdAt"
      ON "feedback_messages" ("createdAt")
    `);

    // 2. New columns on feedback_submissions.
    await queryRunner.query(
      `ALTER TABLE "feedback_submissions" ADD COLUMN IF NOT EXISTS "threadToken" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "feedback_submissions" ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP WITH TIME ZONE`,
    );

    // 3. Backfill: give every existing submission a thread token.
    await queryRunner.query(`
      UPDATE "feedback_submissions"
      SET "threadToken" = replace(gen_random_uuid()::text, '-', '')
      WHERE "threadToken" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_feedback_submissions_threadToken"
      ON "feedback_submissions" ("threadToken")
    `);

    // 4. Seed the thread from legacy single-message columns. The original
    //    submission becomes the first inbound message, and an existing admin
    //    reply becomes the first outbound message.
    await queryRunner.query(`
      INSERT INTO "feedback_messages" ("feedbackId", "direction", "authorType", "body", "createdAt")
      SELECT "id", 'inbound', 'user', "message", "createdAt"
      FROM "feedback_submissions"
    `);

    await queryRunner.query(`
      INSERT INTO "feedback_messages" ("feedbackId", "direction", "authorType", "body", "createdAt")
      SELECT "id", 'outbound', 'admin', "adminReply", COALESCE("answeredAt", "createdAt")
      FROM "feedback_submissions"
      WHERE "adminReply" IS NOT NULL AND "adminReply" <> ''
    `);

    // 5. Backfill lastMessageAt from the newest seeded message.
    await queryRunner.query(`
      UPDATE "feedback_submissions" fs
      SET "lastMessageAt" = COALESCE("answeredAt", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_feedback_submissions_threadToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "feedback_submissions" DROP COLUMN IF EXISTS "lastMessageAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "feedback_submissions" DROP COLUMN IF EXISTS "threadToken"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_feedback_messages_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_feedback_messages_feedbackId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "feedback_messages"`);
  }
}
