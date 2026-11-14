import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the global underpayment tolerance (fiat cents), seeded on the existing
 * global row with the same $0.10 default new installs get.
 */
export class UnderpaymentTolerance1794687600000 implements MigrationInterface {
  name = 'UnderpaymentTolerance1794687600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" ADD "underpaymentToleranceCents" integer`,
    );
    await queryRunner.query(
      `UPDATE "settings" SET "underpaymentToleranceCents" = 10 WHERE "key" = 'global'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "settings" DROP COLUMN "underpaymentToleranceCents"`,
    );
  }
}
