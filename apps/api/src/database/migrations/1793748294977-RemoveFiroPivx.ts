import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops 'firo' and 'pivx' from the chain/asset enums. Postgres can't remove
 * enum values in place, so each type is recreated with only 'xmr'.
 *
 * Refuses to run while Firo/PIVX rows still exist, rather than deleting
 * payment records. Export or delete them first, then restart.
 */
const COLUMNS: { table: string; column: string; type: string }[] = [
  { table: 'invoices', column: 'chain', type: 'invoices_chain_enum' },
  { table: 'invoices', column: 'asset', type: 'invoices_asset_enum' },
  { table: 'payments', column: 'chain', type: 'payments_chain_enum' },
  {
    table: 'webhook_deliveries',
    column: 'chain',
    type: 'webhook_deliveries_chain_enum',
  },
];

export class RemoveFiroPivx1793748294977 implements MigrationInterface {
  name = 'RemoveFiroPivx1793748294977';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column } of COLUMNS) {
      const [{ count }] = await queryRunner.query(
        `SELECT COUNT(*)::int AS count FROM "${table}" WHERE "${column}"::text IN ('firo', 'pivx')`,
      );
      if (count > 0) {
        throw new Error(
          `RemoveFiroPivx: ${count} row(s) in "${table}" still use firo/pivx. ` +
            'Export or delete them before running this migration.',
        );
      }
    }

    for (const { table, column, type } of COLUMNS) {
      await this.recreateEnum(queryRunner, table, column, type, ['xmr']);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column, type } of COLUMNS) {
      await this.recreateEnum(queryRunner, table, column, type, [
        'xmr',
        'firo',
        'pivx',
      ]);
    }
  }

  private async recreateEnum(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    type: string,
    values: string[],
  ): Promise<void> {
    const list = values.map((v) => `'${v}'`).join(', ');
    await queryRunner.query(
      `ALTER TYPE "public"."${type}" RENAME TO "${type}_old"`,
    );
    await queryRunner.query(`CREATE TYPE "public"."${type}" AS ENUM(${list})`);
    await queryRunner.query(
      `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE "public"."${type}" USING "${column}"::text::"public"."${type}"`,
    );
    await queryRunner.query(`DROP TYPE "public"."${type}_old"`);
  }
}
