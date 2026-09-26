/**
 * Applies the schema and, on an empty database, the Abbottabad demo data.
 * Runs once per process (memoized) and is guarded by a Postgres advisory lock so
 * two cold serverless instances cannot both try to create tables.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from '../env.js';
import { getHandle } from './client.js';

const SCHEMA_VERSION = 3;
const LOCK_KEY = 918_273_645;

/**
 * `sql/schema.sql` lives in two places depending on how this file is being run:
 *   - from source (`tsx src/index.ts`)      → server/sql/schema.sql
 *   - compiled (`node dist/index.js`)       → server/dist/sql/schema.sql
 * and on Vercel only `server/dist/**` is shipped with the function, so the
 * compiled location is the one that has to resolve in production. Try both.
 */
const SCHEMA_CANDIDATES = ['../../sql/schema.sql', '../sql/schema.sql'];

function schemaPath(): string {
  for (const candidate of SCHEMA_CANDIDATES) {
    const resolved = fileURLToPath(new URL(candidate, import.meta.url));
    if (fs.existsSync(resolved)) return resolved;
  }
  const tried = SCHEMA_CANDIDATES.map((candidate) => fileURLToPath(new URL(candidate, import.meta.url)));
  throw new Error(`schema.sql not found. Tried:\n  ${tried.join('\n  ')}`);
}

function readSchemaSql(): string {
  return fs.readFileSync(schemaPath(), 'utf8');
}

let readyPromise: Promise<void> | null = null;
let bootstrapInfo: { driver: string; seeded: boolean; alreadyReady: boolean } | null = null;

const MIGRATION_TABLE = `create table if not exists qareeb_schema_migrations (version integer primary key)`;

async function alreadyApplied(): Promise<boolean> {
  const handle = await getHandle();
  await handle.exec(MIGRATION_TABLE);
  const rows = await handle.query<{ n: string }>(
    'select count(*)::int as n from qareeb_schema_migrations where version = $1',
    [SCHEMA_VERSION],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

async function applySchema(): Promise<{ empty: boolean }> {
  const handle = await getHandle();
  const ddl = readSchemaSql();

  const countUsers = async (): Promise<number> => {
    const rows = await handle.query<{ n: string }>('select count(*)::int as n from users');
    return Number(rows[0]?.n ?? 0);
  };

  if (await alreadyApplied()) {
    return { empty: (await countUsers()) === 0 };
  }

  if (handle.driver === 'pglite') {
    // Single connection in a single process: the file is idempotent by design.
    await handle.exec(ddl);
    await handle.exec(`insert into qareeb_schema_migrations (version) values (${SCHEMA_VERSION})`);
    return { empty: (await countUsers()) === 0 };
  }

  await handle.exec('begin');
  try {
    await handle.query('select pg_advisory_xact_lock($1)', [LOCK_KEY]);
    await handle.exec(ddl);
    await handle.exec(`insert into qareeb_schema_migrations (version) values (${SCHEMA_VERSION})`);
    const empty = (await countUsers()) === 0;
    await handle.exec('commit');
    return { empty };
  } catch (error) {
    await handle.exec('rollback').catch(() => undefined);
    throw error;
  }
}

/**
 * `db:reset` / `db:seed` run this same module, so bootstrap must not import the
 * seed back while the seed script is mid-evaluation (that deadlocks the ESM
 * graph): the CLI seeds explicitly after ensureDatabase() returns.
 */
const isSeedCli = /(^|[\\/])seed\.[cm]?[jt]s$/.test(process.argv[1] ?? '');

async function run(): Promise<void> {
  const started = Date.now();
  const { empty } = await applySchema();
  const handle = await getHandle();

  let seeded = false;
  if (empty && env.autoSeed && !isSeedCli) {
    const { seedDemoData } = await import('./seed.js');
    await seedDemoData({ reset: false, quiet: true });
    seeded = true;
  }

  bootstrapInfo = { driver: handle.driver, seeded, alreadyReady: false };
  await getHandle().then((h) =>
    h.query('select 1').catch(() => undefined),
  );
  console.log(
    `[qareeb] database ready (${handle.driver}) in ${Date.now() - started}ms${seeded ? ' — demo data seeded' : ''}`,
  );
}

export function ensureDatabase(): Promise<void> {
  readyPromise ??= run().catch((error) => {
    readyPromise = null;
    throw error;
  });
  return readyPromise;
}

export function databaseReport() {
  return bootstrapInfo;
}

/** Wipes every application table but keeps the schema in place. */
export async function truncateAll(): Promise<void> {
  const handle = await getHandle();
  await handle.exec(`
    truncate table
      realtime_events, push_subscriptions, refresh_tokens, messages, order_events,
      order_items, payment_transactions, reviews, favorites, notifications,
      shop_runners, delivery_zones, products, orders, shops,
      runner_profiles, addresses, audit_logs, campaigns, service_areas,
      api_rate_limits, uploaded_images, users, settings
    restart identity cascade;
  `);
}
