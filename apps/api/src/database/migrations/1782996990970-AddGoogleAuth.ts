import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGoogleAuth1782996990970 implements MigrationInterface {
    name = 'AddGoogleAuth1782996990970'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feedback_messages" DROP CONSTRAINT "FK_feedback_messages_feedback"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_feedback_submissions_threadToken"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_feedback_messages_feedbackId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_feedback_messages_createdAt"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "googleId" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_f382af58ab36057334fb262efd5" UNIQUE ("googleId")`);
        await queryRunner.query(`ALTER TABLE "users" ADD "avatarUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "feedback_submissions" ADD CONSTRAINT "UQ_fda8e2a87e5d94a2aa268c5fd54" UNIQUE ("threadToken")`);
        await queryRunner.query(`ALTER TABLE "feedback_messages" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "feedback_messages" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`CREATE INDEX "IDX_cd99cfb4e6528adcd6fe0fa0ea" ON "feedback_messages" ("feedbackId") `);
        await queryRunner.query(`ALTER TABLE "feedback_messages" ADD CONSTRAINT "FK_cd99cfb4e6528adcd6fe0fa0ea5" FOREIGN KEY ("feedbackId") REFERENCES "feedback_submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feedback_messages" DROP CONSTRAINT "FK_cd99cfb4e6528adcd6fe0fa0ea5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cd99cfb4e6528adcd6fe0fa0ea"`);
        await queryRunner.query(`ALTER TABLE "feedback_messages" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "feedback_messages" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "feedback_submissions" DROP CONSTRAINT "UQ_fda8e2a87e5d94a2aa268c5fd54"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "passwordHash" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_f382af58ab36057334fb262efd5"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "googleId"`);
        await queryRunner.query(`CREATE INDEX "IDX_feedback_messages_createdAt" ON "feedback_messages" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_feedback_messages_feedbackId" ON "feedback_messages" ("feedbackId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_feedback_submissions_threadToken" ON "feedback_submissions" ("threadToken") `);
        await queryRunner.query(`ALTER TABLE "feedback_messages" ADD CONSTRAINT "FK_feedback_messages_feedback" FOREIGN KEY ("feedbackId") REFERENCES "feedback_submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
