import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'supabase', 'schema.sql');
const to = path.join(root, 'server', 'dist', 'schema.sql');
fs.mkdirSync(path.dirname(to), { recursive: true });
fs.copyFileSync(from, to);
