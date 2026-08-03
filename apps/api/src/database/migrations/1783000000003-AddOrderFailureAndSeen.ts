import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds failure tracking and an admin "seen" flag to orders.
 *
 * Since payment is charged automatically via SUMIT, an order that fails to
 * charge is now marked `failed` with the gateway error stored in
 * `failureReason` (a `pending` order is an abandoned/unfinished attempt).
 * `seenByAdmin` powers the "new successful purchases" badge in the admin nav.
 */
export class AddOrderFailureAndSeen1783000000003
  implements MigrationInterface
{
  name = 'AddOrderFailureAndSeen1783000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "failureReason" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "seenByAdmin" boolean NOT NULL DEFAULT false`,
    );
    // Existing approved orders predate the badge — treat them as already seen
    // so the admin isn't greeted by a huge count on first load.
    await queryRunner.query(
      `UPDATE "orders" SET "seenByAdmin" = true WHERE "status" = 'approved'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "seenByAdmin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "failedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "failureReason"`,
    );
  }
}
