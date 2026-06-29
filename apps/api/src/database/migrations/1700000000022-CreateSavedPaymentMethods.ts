import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSavedPaymentMethods1700000000022
  implements MigrationInterface
{
  name = 'CreateSavedPaymentMethods1700000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saved_payment_methods" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "sumitCustomerId" character varying NOT NULL,
        "cardToken" character varying NOT NULL,
        "last4" character varying,
        "brand" character varying,
        "expMonth" character varying,
        "expYear" character varying,
        "citizenId" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_payment_methods" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_saved_payment_methods_user" UNIQUE ("userId"),
        CONSTRAINT "FK_saved_payment_methods_user" FOREIGN KEY ("userId")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "saved_payment_methods"`,
    );
  }
}
