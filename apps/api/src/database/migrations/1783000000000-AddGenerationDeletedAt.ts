import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGenerationDeletedAt1783000000000
  implements MigrationInterface
{
  name = 'AddGenerationDeletedAt1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "generations"
      DROP COLUMN IF EXISTS "deletedAt"
    `);
  }
}
