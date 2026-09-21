import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import bcrypt from 'bcryptjs';

const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const demo = await readFile(new URL('../supabase/demo.sql', import.meta.url), 'utf8');

test('Supabase SQL files install and demo passwords work with Qareeb login', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    await db.exec(schema);
    await db.exec(schema); // idempotent schema
    const password = 'a-unique-test-password-123';
    // Only replace the configuration value, not the guard comparing against it.
    await db.exec(demo.replace("set_config('qareeb.demo_password', 'REPLACE_WITH_YOUR_OWN_PASSWORD'", `set_config('qareeb.demo_password', '${password}'`));
    const result = await db.query("SELECT password_hash FROM users WHERE email = 'ali@demo.com'");
    assert.equal(result.rows.length, 1);
    assert.ok(await bcrypt.compare(password, result.rows[0].password_hash));
    assert.equal(Number((await db.query('SELECT count(*) AS n FROM shops')).rows[0].n), 10);
    assert.equal(Number((await db.query('SELECT count(*) AS n FROM products')).rows[0].n), 162);
    await assert.rejects(db.exec(demo.replace("set_config('qareeb.demo_password', 'REPLACE_WITH_YOUR_OWN_PASSWORD'", `set_config('qareeb.demo_password', '${password}'`)), /Database already has users/);
    await db.exec('ROLLBACK');
    assert.equal(Number((await db.query('SELECT count(*) AS n FROM shops')).rows[0].n), 10);
    // Supabase browser roles must not read hashes, addresses or event payloads.
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      for (const table of ['users', 'orders', 'addresses', 'realtime_events']) {
        await assert.rejects(db.query(`SELECT * FROM ${table}`), /permission denied/);
      }
      await db.exec('RESET ROLE');
    }
  } finally { await db.close(); }
});
test('demo import refuses an unchanged placeholder without partially seeding', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(schema);
    await assert.rejects(db.exec(demo), /Choose your own demo password/);
    await db.exec('ROLLBACK');
    assert.equal(Number((await db.query('SELECT count(*) AS n FROM users')).rows[0].n), 0);
  } finally { await db.close(); }
});
test('storage SQL configures a public image bucket with a 3 MB limit', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE SCHEMA storage; CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);');
    const sql = await readFile(new URL('../supabase/storage.sql', import.meta.url), 'utf8');
    await db.exec(sql); await db.exec(sql);
    const result = (await db.query('SELECT * FROM storage.buckets')).rows[0];
    assert.equal(result.public, true);
    assert.equal(Number(result.file_size_limit), 3145728);
    assert.ok(result.allowed_mime_types.includes('image/png'));
    assert.ok(!result.allowed_mime_types.includes('text/html'));
  } finally { await db.close(); }
});
test('serverless adapter reports missing setup without starting a local database', async () => {
  const { default: handler } = await import('../api/index.js');
  const old = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    let status, body;
    const response = { status(s) { status = s; return this; }, json(b) { body = b; return this; } };
    await handler({}, response);
    assert.equal(status, 503);
    assert.equal(body.setup, true);
    assert.match(body.error, /database|Storage|POSTGRES_URL|DATABASE_URL/i);
  } finally { if (old === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = old; }
});
