import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeedbackSubmissions1700000000005 implements MigrationInterface {
  name = 'CreateFeedbackSubmissions1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feedback_submissions" (
        "id"        uuid              NOT NULL DEFAULT gen_random_uuid(),
        "userId"    uuid              NOT NULL,
        "type"      character varying NOT NULL DEFAULT 'request',
        "title"     character varying(120) NOT NULL,
        "message"   text              NOT NULL,
        "status"    character varying NOT NULL DEFAULT 'open',
        "adminReply" text,
        "answeredAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feedback_submissions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_feedback_submissions_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_feedback_submissions_createdAt"
      ON "feedback_submissions" ("createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_feedback_submissions_createdAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feedback_submissions"`);
  }
}
