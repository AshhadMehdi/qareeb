// Build first. Export ONLY a fresh, in-memory demo database, never real app data.
import { writeFile } from 'node:fs/promises';
import { getTableColumns, getTableName } from 'drizzle-orm';
Object.assign(process.env, { DATABASE_URL: '', VERCEL: '', LOCAL_DATABASE_PATH: ':memory:', DEMO_PASSWORD: 'temporary-export-only' });
const { db, schema, runMigrations, closeDatabase } = await import('../server/dist/db/index.js');
const names = ['settings', 'users', 'addresses', 'shops', 'deliveryZones', 'products', 'runnerProfiles', 'shopRunners', 'promos', 'orders', 'orderItems', 'orderEvents', 'reviews', 'notifications', 'messages', 'favorites'];
const quote = (s) => "'" + String(s).replaceAll("'", "''") + "'";
try {
  await runMigrations();
  await (await import('../server/dist/db/seed.js')).seedIfEmpty();
  let output = `-- OPTIONAL DEMO DATA. Only use in a new, empty Qareeb database.\n-- Edit the password below IN THE SUPABASE SQL EDITOR, not in a public GitHub file.\n-- Use a unique password of at least 12 characters; no apostrophes.\n-- It is shared by the demo accounts; change individual account passwords before real use.\nBEGIN;\nCREATE SCHEMA IF NOT EXISTS extensions;\nCREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;\nSET LOCAL search_path = public, extensions;\nSELECT set_config('qareeb.demo_password', 'REPLACE_WITH_YOUR_OWN_PASSWORD', true);\nDO $check$ BEGIN\n  IF length(current_setting('qareeb.demo_password')) < 12 OR current_setting('qareeb.demo_password') = 'REPLACE_WITH_YOUR_OWN_PASSWORD' THEN\n    RAISE EXCEPTION 'Choose your own demo password on the set_config line (at least 12 characters).';\n  END IF;\n  IF EXISTS (SELECT 1 FROM public.users) THEN RAISE EXCEPTION 'Database already has users. Demo import cancelled; no data has been changed.'; END IF;\nEND $check$;\nSELECT set_config('qareeb.demo_hash', crypt(current_setting('qareeb.demo_password'), gen_salt('bf', 10)), true);\n`;
  for (const name of names) {
    const table = schema[name];
    const columns = getTableColumns(table);
    const rows = await db.select().from(table);
    if (!rows.length) continue;
    const keys = Object.keys(columns);
    output += `\nINSERT INTO public."${getTableName(table)}" (${keys.map(k => '"' + columns[k].name + '"').join(', ')}) VALUES\n`;
    output += rows.map(row => '(' + keys.map(k => {
      const value = row[k];
      if (value === null || value === undefined) return 'NULL';
      if (name === 'users' && k === 'passwordHash') return "current_setting('qareeb.demo_hash')";
      if (columns[k].getSQLType() === 'jsonb') return quote(JSON.stringify(value)) + '::jsonb';
      if (typeof value === 'number') return String(value);
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      return quote(value);
    }).join(', ') + ')').join(',\n') + ';\n';
  }
  output += '\nCOMMIT;\n';
  await writeFile(new URL('../supabase/demo.sql', import.meta.url), output);
  console.log('Wrote supabase/demo.sql. Password must be chosen in the SQL editor.');
} finally { await closeDatabase(); }
