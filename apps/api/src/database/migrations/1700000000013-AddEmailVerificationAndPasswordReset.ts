import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerificationAndPasswordReset1700000000013
  implements MigrationInterface
{
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "emailVerified" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "emailVerificationToken" varchar DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "emailVerificationExpiry" timestamptz DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "resetPasswordToken" varchar DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "resetPasswordExpiry" timestamptz DEFAULT NULL
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "emailVerified",
        DROP COLUMN IF EXISTS "emailVerificationToken",
        DROP COLUMN IF EXISTS "emailVerificationExpiry",
        DROP COLUMN IF EXISTS "resetPasswordToken",
        DROP COLUMN IF EXISTS "resetPasswordExpiry"
    `);
  }
}
