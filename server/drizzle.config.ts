import { defineConfig } from 'drizzle-kit';

// Used for `npm run db:generate` / `db:studio` against a real Postgres.
// The app never needs this at runtime: server/sql/schema.sql is applied on boot
// (plain Postgres on Vercel, PGlite in local development).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/qareeb',
  },
  strict: false,
  verbose: true,
});
