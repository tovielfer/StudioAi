import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProviderErrorRaw1700000000010 implements MigrationInterface {
  name = 'AddProviderErrorRaw1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      ADD COLUMN IF NOT EXISTS "providerErrorRaw" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      DROP COLUMN IF EXISTS "providerErrorRaw"
    `);
  }
}
