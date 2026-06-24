import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves user balances to the new credit unit. Previously a credit was ~$0.01
 * (~ILS 0.037); now a credit is ILS 0.01. To preserve the shekel value of
 * existing (test) balances we multiply by the old/new ratio (~3.7), and set the
 * new signup default to 150 credits (~ILS 1.5).
 */
export class RescaleUserCredits1700000000015 implements MigrationInterface {
  name = 'RescaleUserCredits1700000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "credits" SET DEFAULT 150`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "credits" = ROUND("credits" * 3.7)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "credits" SET DEFAULT 25`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "credits" = ROUND("credits" / 3.7)`,
    );
  }
}
