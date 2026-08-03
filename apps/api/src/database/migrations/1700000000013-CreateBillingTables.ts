import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBillingTables1700000000013 implements MigrationInterface {
  name = 'CreateBillingTables1700000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credit_packages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "priceIls" numeric(10,2) NOT NULL DEFAULT 0,
        "credits" integer NOT NULL DEFAULT 0,
        "badge" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credit_packages" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "packageId" uuid,
        "packageName" character varying NOT NULL,
        "priceIls" numeric(10,2) NOT NULL DEFAULT 0,
        "credits" integer NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'pending',
        "provider" character varying,
        "providerRef" character varying,
        "note" character varying,
        "decidedByUserId" uuid,
        "decidedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_user" ON "orders" ("userId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_orders_status" ON "orders" ("status", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_packages"`);
  }
}
