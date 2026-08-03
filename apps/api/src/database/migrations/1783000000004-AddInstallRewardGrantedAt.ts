import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `installRewardGrantedAt` to users. It records when the one-time
 * "installed the app" credit bonus was granted and doubles as the idempotency
 * guard: a non-null value means the bonus was already given, so it can never be
 * granted twice.
 */
export class AddInstallRewardGrantedAt1783000000004
  implements MigrationInterface
{
  name = 'AddInstallRewardGrantedAt1783000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "installRewardGrantedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "installRewardGrantedAt"`,
    );
  }
}
