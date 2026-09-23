/**
 * One database handle, two drivers.
 *
 * - Vercel / any DATABASE_URL  -> node-postgres against managed PostgreSQL.
 * - local development          -> PGlite (PostgreSQL in WASM) persisted under
 *                                 server/data/postgres, so `npm run dev` needs
 *                                 no database server installed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { env, hasHostedDatabase } from '../env.js';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;
export type Driver = 'postgres' | 'pglite';

export type DbHandle = {
  db: Database;
  driver: Driver;
  exec(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
};

let handlePromise: Promise<DbHandle> | null = null;

function localDataDir(): string {
  const configured = env.localDatabasePath.trim();
  if (!configured) return path.resolve(process.cwd(), 'data', 'postgres');
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

async function createHandle(): Promise<DbHandle> {
  if (hasHostedDatabase()) {
    const needsSsl = !/localhost|127\.0\.0\.1/.test(env.databaseUrl);
    const pool = new Pool({
      connectionString: env.databaseUrl,
      max: env.isVercel ? 3 : 10,
      idleTimeoutMillis: 20_000,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
    // A dead idle connection must not take the function down.
    pool.on('error', (error) => console.error('[qareeb] idle postgres client error:', error.message));
    const db = drizzlePg(pool, { schema });
    return {
      db,
      driver: 'postgres',
      async exec(sql) {
        await pool.query(sql);
      },
      async query<T>(sql: string, params?: unknown[]) {
        const result = await pool.query(sql, params as never);
        return result.rows as T[];
      },
      async close() {
        await pool.end();
      },
    };
  }

  if (env.isVercel) {
    throw new Error(
      'No DATABASE_URL on Vercel. Add Storage → Neon (Postgres) in the Vercel dashboard, then redeploy.',
    );
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const dataDir = localDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema }) as unknown as Database;
  return {
    db,
    driver: 'pglite',
    async exec(sql) {
      await client.exec(sql);
    },
    async query<T>(sql: string, params?: unknown[]) {
      const result = await client.query<T>(sql, params as never[]);
      return result.rows;
    },
    async close() {
      await client.close();
    },
  };
}

/** Memoized so a warm lambda (or a dev restart) reuses one pool. */
export function getHandle(): Promise<DbHandle> {
  handlePromise ??= createHandle().catch((error) => {
    handlePromise = null;
    throw error;
  });
  return handlePromise;
}

export async function getDb(): Promise<Database> {
  return (await getHandle()).db;
}

export async function closeDb(): Promise<void> {
  if (!handlePromise) return;
  const handle = await handlePromise.catch(() => null);
  handlePromise = null;
  await handle?.close();
}

export { schema };
