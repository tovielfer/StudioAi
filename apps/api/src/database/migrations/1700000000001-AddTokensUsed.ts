import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokensUsed1700000000001 implements MigrationInterface {
  name = 'AddTokensUsed1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      ADD COLUMN IF NOT EXISTS "tokensUsed" jsonb DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      DROP COLUMN IF EXISTS "tokensUsed"
    `);
  }
}
