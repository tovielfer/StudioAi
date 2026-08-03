import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameGemini3ProImageModel1700000000011
  implements MigrationInterface
{
  name = 'RenameGemini3ProImageModel1700000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "ai_pricing_rules"
      SET "model" = 'gemini-3-pro-image'
      WHERE "model" = 'gemini-3-pro-image-preview'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "ai_pricing_rules"
      SET "model" = 'gemini-3-pro-image-preview'
      WHERE "model" = 'gemini-3-pro-image'
    `);
  }
}
