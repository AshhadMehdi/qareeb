// Ships the schema SQL next to the compiled server so both `npm start` and the
// Vercel function can apply it on the first request.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(here, '..', 'sql');
const to = path.join(here, '..', 'dist', 'sql');

fs.mkdirSync(to, { recursive: true });
for (const file of fs.readdirSync(from)) {
  fs.copyFileSync(path.join(from, file), path.join(to, file));
}
console.log(`copied ${fs.readdirSync(to).length} sql file(s) to dist/sql`);
