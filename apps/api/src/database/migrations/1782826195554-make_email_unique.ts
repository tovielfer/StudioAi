import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeEmailUnique1782826195554 implements MigrationInterface {
    name = 'MakeEmailUnique1782826195554'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, handle duplicates. We want to keep the one that is verified if possible,
        // otherwise keep the one with the most credits, otherwise keep the oldest.
        // We do this by updating the email of the duplicates (appending a suffix)
        // instead of deleting them outright, so we don't accidentally violate foreign keys
        // or lose user data/generations/credits.
        await queryRunner.query(`
            UPDATE "users"
            SET email = email || '+' || substring(id::text from 1 for 8) || '@duplicate.local'
            WHERE id IN (
                SELECT id
                FROM (
                    SELECT id,
                    ROW_NUMBER() OVER (
                        PARTITION BY LOWER(TRIM("email")) 
                        ORDER BY 
                            "emailVerified" DESC,
                            "credits" DESC,
                            "createdAt" ASC
                    ) as rnum
                    FROM "users"
                ) t
                WHERE t.rnum > 1
            );
        `);
        
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_97672ac88f789774dd47f7c8be3"`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3"`);
    }

}
