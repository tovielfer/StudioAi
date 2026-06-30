import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNickname1700000000022 implements MigrationInterface {
  name = 'AddUserNickname1700000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "nickname" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "nickname"
    `);
  }
}
