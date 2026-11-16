import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the 'invoice.cancelled' webhook event, sent when an admin or manager
 * cancels a pending invoice.
 */
export class InvoiceCancelledWebhook1794787200000 implements MigrationInterface {
  name = 'InvoiceCancelledWebhook1794787200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."webhook_deliveries_event_enum" ADD VALUE IF NOT EXISTS 'invoice.cancelled'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres can't drop an enum value in place: remove the deliveries that
    // use it, then recreate the type without it.
    await queryRunner.query(
      `DELETE FROM "webhook_deliveries" WHERE "event" = 'invoice.cancelled'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."webhook_deliveries_event_enum" RENAME TO "webhook_deliveries_event_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."webhook_deliveries_event_enum" AS ENUM('invoice.seen', 'invoice.confirmed', 'invoice.underpaid', 'invoice.expired')`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" ALTER COLUMN "event" TYPE "public"."webhook_deliveries_event_enum" USING "event"::text::"public"."webhook_deliveries_event_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."webhook_deliveries_event_enum_old"`,
    );
  }
}
