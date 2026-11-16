import { readdirSync } from 'fs';
import { join } from 'path';
import { DataSource, type MigrationInterface } from 'typeorm';
import { AppDataSource } from '../../src/database/data-source';

/**
 * Runs the real migrations against a real Postgres. Each run creates its own
 * throwaway database on the server in MIGRATION_TEST_DATABASE_URL and drops
 * it afterwards, so the database that URL names is only used to issue
 * CREATE/DROP DATABASE (the role needs CREATEDB). Skipped when it's unset.
 */
const SERVER_URL = process.env.MIGRATION_TEST_DATABASE_URL;

const MIGRATIONS_DIR = join(__dirname, '../../src/database/migrations');

/** Every migration class, oldest first, loaded the way the app finds them. */
function loadMigrations(): (new () => MigrationInterface)[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .flatMap((f) => {
      // Synchronous on purpose: the list is needed while the suite is defined,
      // and require() goes through ts-jest so the .ts files load as-is.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(join(MIGRATIONS_DIR, f)) as Record<string, unknown>;
      return Object.values(mod).filter(
        (v): v is new () => MigrationInterface => typeof v === 'function',
      );
    });
}

function withDatabase(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

(SERVER_URL ? describe : describe.skip)('database migrations', () => {
  const migrations = loadMigrations();
  const dbName = `mintit_migrations_${Date.now()}`;
  let admin: DataSource;
  let ds: DataSource;

  const tables = async (): Promise<string[]> =>
    (
      await ds.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
      )
    ).map((r: { table_name: string }) => r.table_name);

  const applied = async (): Promise<number> =>
    (await ds.query(`SELECT COUNT(*)::int AS n FROM "migrations"`))[0].n;

  beforeAll(async () => {
    admin = await new DataSource({
      type: 'postgres',
      url: SERVER_URL,
    }).initialize();
    await admin.query(`CREATE DATABASE "${dbName}"`);

    ds = await new DataSource({
      ...AppDataSource.options,
      url: withDatabase(SERVER_URL!, dbName),
      migrations,
      synchronize: false,
      migrationsRun: false,
      logging: false,
    } as typeof AppDataSource.options).initialize();
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      await admin.destroy();
    }
  });

  it('finds the migrations', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it('applies every migration to an empty database', async () => {
    const ran = await ds.runMigrations();
    expect(ran).toHaveLength(migrations.length);
    expect(await tables()).toEqual(
      expect.arrayContaining(['invoices', 'payments', 'webhook_deliveries']),
    );
  });

  it('leaves no drift between the entities and the migrated schema', async () => {
    // What `migration:generate` would write if run now: should be nothing.
    const { upQueries } = await ds.driver.createSchemaBuilder().log();
    expect(upQueries.map((q) => q.query)).toEqual([]);
  });

  it('has the invoice.cancelled webhook event', async () => {
    const [{ values }] = await ds.query(
      `SELECT enum_range(NULL::"webhook_deliveries_event_enum")::text[] AS values`,
    );
    expect(values).toContain('invoice.cancelled');
  });

  it('reverts every migration back to an empty schema', async () => {
    for (let i = 0; i < migrations.length; i++) {
      await ds.undoLastMigration();
    }
    expect(await applied()).toBe(0);
    expect(await tables()).toEqual(['migrations']);
  });

  it('re-applies cleanly after a full revert', async () => {
    const ran = await ds.runMigrations();
    expect(ran).toHaveLength(migrations.length);
    const { upQueries } = await ds.driver.createSchemaBuilder().log();
    expect(upQueries.map((q) => q.query)).toEqual([]);
  });
});
