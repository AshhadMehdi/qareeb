// Built server files are included by vercel.json. Lazy loading gives a helpful
// setup response even when a database has not been connected yet.
function hostedDatabaseUrl() {
  const keys = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'NEON_DATABASE_URL'];
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value && /^postgres(ql)?:\/\//i.test(value)) return value;
  }
  const host = process.env.PGHOST || process.env.POSTGRES_HOST;
  const user = process.env.PGUSER || process.env.POSTGRES_USER;
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
  const database = process.env.PGDATABASE || process.env.POSTGRES_DATABASE || 'postgres';
  const port = process.env.PGPORT || process.env.POSTGRES_PORT || '5432';
  if (host && user && password) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=require`;
  }
  return '';
}

function publicError(error) {
  return String(error?.message || error || 'The API could not start')
    .replace(/postgres(ql)?:\/\/[^@\s]+@/gi, 'postgresql://***@')
    .slice(0, 300);
}

let handler;
export default async function endpoint(req, res) {
  try {
    const url = hostedDatabaseUrl();
    if (!url) {
      return res.status(503).json({
        ok: false,
        setup: true,
        error: 'Add a database in Vercel: Storage → Create Database → Neon (or Postgres). Connect it to this project, wait until it says Connected, then Redeploy. Delete VITE_API_URL. Root Directory must stay empty (not client).',
      });
    }
    process.env.DATABASE_URL = process.env.DATABASE_URL || url;
    handler ??= import('../server/dist/serverless.js').then((m) => m.default).catch((e) => { handler = undefined; throw e; });
    return (await handler)(req, res);
  } catch (error) {
    console.error('[api] startup failed:', error.message);
    return res.status(503).json({ ok: false, setup: true, error: publicError(error) });
  }
}
