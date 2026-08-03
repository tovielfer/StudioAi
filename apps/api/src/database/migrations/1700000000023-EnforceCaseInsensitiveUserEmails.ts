import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceCaseInsensitiveUserEmails1700000000023
  implements MigrationInterface
{
  name = 'EnforceCaseInsensitiveUserEmails1700000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        duplicate_count integer;
      BEGIN
        SELECT COUNT(*)
        INTO duplicate_count
        FROM (
          SELECT LOWER(TRIM(email))
          FROM "users"
          GROUP BY LOWER(TRIM(email))
          HAVING COUNT(*) > 1
        ) duplicate_emails;

        IF duplicate_count > 0 THEN
          RAISE EXCEPTION 'Cannot enforce case-insensitive user emails: found % duplicate lowercase email group(s)', duplicate_count;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "email" = LOWER(TRIM("email"))
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP CONSTRAINT IF EXISTS "UQ_users_email"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email_lower"
      ON "users" (LOWER(TRIM("email")))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_users_email_lower"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")
    `);
  }
}
