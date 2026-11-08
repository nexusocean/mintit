import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves backup codes from the users.backupCodes array into their own table,
 * one row per code, so a code can be consumed atomically. Also adds
 * users.pendingTotpSecret for confirm-before-replace TOTP resets.
 *
 * Existing codes are copied as-is; any legacy unhashed ones are hashed by
 * TotpService on startup, since that needs the TOTP key.
 */
export class BackupCodesAndTotpReset1794134400000 implements MigrationInterface {
  name = 'BackupCodesAndTotpReset1794134400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "backup_codes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "userId" uuid NOT NULL, "codeHash" character varying NOT NULL, "pending" boolean NOT NULL DEFAULT false, "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_backup_codes_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_backup_codes_userId_codeHash" ON "backup_codes" ("userId", "codeHash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "backup_codes" ADD CONSTRAINT "FK_backup_codes_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `INSERT INTO "backup_codes" ("userId", "codeHash") SELECT "id", unnest("backupCodes") FROM "users"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "backupCodes"`);
    // IF [NOT] EXISTS: an earlier draft of this change added
    // pendingTotpSecret and a pendingBackupCodes array to dev databases.
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pendingTotpSecret" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "pendingBackupCodes"`,
    );
    // A draft-era pending secret has lost its pending codes; confirming it
    // would leave the user with none, so drop any in-progress reset.
    await queryRunner.query(`UPDATE "users" SET "pendingTotpSecret" = NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "pendingTotpSecret"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "backupCodes" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `UPDATE "users" u SET "backupCodes" = c.codes FROM (SELECT "userId", array_agg("codeHash") AS codes FROM "backup_codes" WHERE NOT "pending" AND "usedAt" IS NULL GROUP BY "userId") c WHERE c."userId" = u."id"`,
    );
    await queryRunner.query(`DROP TABLE "backup_codes"`);
  }
}
