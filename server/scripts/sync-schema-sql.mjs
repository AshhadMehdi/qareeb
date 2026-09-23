#!/usr/bin/env node
/**
 * Regenerates sql/schema.sql from src/db/schema.ts.
 *
 * The app applies this file on the first request (real Postgres on Vercel,
 * PGlite locally) instead of running drizzle-kit migrate, so it must be
 * idempotent: CREATE TABLE / CREATE INDEX statements get IF NOT EXISTS and the
 * whole file is wrapped in a version marker.
 *
 * Usage: npm run db:schema -w server
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');
const outDir = path.join(serverRoot, '.drizzle-tmp');
const target = path.join(serverRoot, 'sql', 'schema.sql');

fs.rmSync(outDir, { recursive: true, force: true });

execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['drizzle-kit', 'generate', '--dialect=postgresql', '--schema=./src/db/schema.ts', `--out=${outDir}`],
  { cwd: serverRoot, stdio: ['ignore', 'pipe', 'inherit'] },
);

const sqlFile = fs
  .readdirSync(outDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .pop();

if (!sqlFile) {
  console.error('drizzle-kit produced no .sql file');
  process.exit(1);
}

const raw = fs.readFileSync(path.join(outDir, sqlFile), 'utf8');

const statements = raw
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim().replace(/;$/, ''))
  .filter(Boolean)
  .map((statement) => {
    const createLike = statement
      .replace(/^CREATE TABLE "/m, 'CREATE TABLE IF NOT EXISTS "')
      .replace(/^CREATE UNIQUE INDEX "/m, 'CREATE UNIQUE INDEX IF NOT EXISTS "')
      .replace(/^CREATE INDEX "/m, 'CREATE INDEX IF NOT EXISTS "');
    // foreign keys arrive as ALTER TABLE ... ADD CONSTRAINT, which is not
    // idempotent on its own — wrap it so a re-run cannot fail the boot.
    const foreignKey = /^ALTER TABLE "(\w+)" ADD CONSTRAINT "(\w+)" ([\s\S]*)$/.exec(createLike);
    if (foreignKey) {
      return `DO $$
BEGIN
  ALTER TABLE "${foreignKey[1]}" ADD CONSTRAINT "${foreignKey[2]}" ${foreignKey[3]};
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`;
    }
    return createLike;
  });

const header = `-- GENERATED FILE — do not edit by hand.
-- Source of truth: server/src/db/schema.ts  (regenerate: npm run db:schema -w server)
-- Applied automatically on the first request; safe to re-run.
`;

const body = `${header}\nBEGIN;\n\n${statements.join(';\n\n')};\n\nCOMMIT;\n`;
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, body);

fs.rmSync(outDir, { recursive: true, force: true });
console.log(`wrote ${path.relative(serverRoot, target)} (${statements.length} statements)`);
