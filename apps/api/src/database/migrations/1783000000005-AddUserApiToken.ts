import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserApiToken1783000000005 implements MigrationInterface {
  name = 'AddUserApiToken1783000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "apiTokenHash" character varying,
      ADD COLUMN IF NOT EXISTS "apiTokenPrefix" character varying,
      ADD COLUMN IF NOT EXISTS "apiTokenCreatedAt" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_apiTokenHash"
      ON "users" ("apiTokenHash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_users_apiTokenHash"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "apiTokenHash",
      DROP COLUMN IF EXISTS "apiTokenPrefix",
      DROP COLUMN IF EXISTS "apiTokenCreatedAt"
    `);
  }
}
