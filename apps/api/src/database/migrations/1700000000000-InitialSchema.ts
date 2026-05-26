import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"            uuid              NOT NULL DEFAULT gen_random_uuid(),
        "email"         character varying NOT NULL,
        "passwordHash"  character varying NOT NULL,
        "credits"       integer           NOT NULL DEFAULT 25,
        "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "generations" (
        "id"                 uuid              NOT NULL DEFAULT gen_random_uuid(),
        "userId"             uuid              NOT NULL,
        "type"               character varying NOT NULL DEFAULT 'image',
        "prompt"             text              NOT NULL,
        "model"              character varying NOT NULL,
        "status"             character varying NOT NULL DEFAULT 'pending',
        "resultUrl"          character varying,
        "referenceImageUrl"  character varying,
        "quality"            character varying NOT NULL DEFAULT 'standard',
        "size"               character varying NOT NULL DEFAULT '1:1',
        "provider"           character varying NOT NULL DEFAULT 'mock',
        "creditCost"         integer           NOT NULL DEFAULT 0,
        "errorMessage"       text,
        "createdAt"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_generations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_generations_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credit_transactions" (
        "id"        uuid              NOT NULL DEFAULT gen_random_uuid(),
        "userId"    uuid              NOT NULL,
        "amount"    integer           NOT NULL,
        "reason"    character varying NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credit_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_credit_transactions_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "generations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
