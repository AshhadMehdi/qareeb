/**
 * Long-running server: `npm run dev` (tsx watch) and `npm start` (compiled).
 * Vercel uses src/serverless.ts instead, which reuses createApp().
 */
import { createApp } from './app.js';
import { closeDb } from './db/client.js';
import { ensureDatabase } from './db/bootstrap.js';
import { env, hasHostedDatabase } from './env.js';

const app = createApp();

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`\n  Qareeb API  →  http://localhost:${env.port}/api`);
  console.log(`  database    →  ${hasHostedDatabase() ? 'hosted PostgreSQL' : 'local PGlite (server/data/postgres)'}\n`);
});

// Warm the schema and demo data in the background so the first request is fast.
ensureDatabase().catch((error) => {
  console.error('[qareeb] database bootstrap failed:', (error as Error).message);
  console.error('         The API still started — check /api/health for details.');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n[qareeb] ${signal} — shutting down`);
    server.close(async () => {
      await closeDb().catch(() => undefined);
      process.exit(0);
    });
  });
}
