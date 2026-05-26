import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameDallEToGptImage11748131200000 implements MigrationInterface {
  name = 'RenameDallEToGptImage11748131200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE generations
      SET model = 'gpt-image-1'
      WHERE model IN ('dall-e-3', 'dall-e-2')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE generations
      SET model = 'dall-e-3'
      WHERE model = 'gpt-image-1'
        AND provider = 'openai'
    `);
  }
}
