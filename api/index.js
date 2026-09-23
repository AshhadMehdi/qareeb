// Vercel serverless entry point.
//
// Everything under /api is handled by the Express app that is compiled to
// server/dist. vercel.json ships that folder with this function
// (`includeFiles`), so no VITE_API_URL and no second deployment are needed:
// the static client and the API live on the same origin.
//
// The import is lazy so that a project with no database connected still boots
// and answers with a readable setup message instead of a 500 stack trace.

const DATABASE_URL_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'NEON_DATABASE_URL',
];

function hostedDatabaseUrl() {
  for (const key of DATABASE_URL_KEYS) {
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
    .replace(/postgres(ql)?:\/\/[^@\s]*@/gi, 'postgresql://***@')
    .slice(0, 400);
}

let loading;

export default async function handler(req, res) {
  try {
    const url = hostedDatabaseUrl();
    if (!url) {
      res.status(503).json({
        ok: false,
        setup: true,
        error:
          'No database connected. In Vercel open Storage → Create Database → Neon (Postgres), connect it to this project, then redeploy. Leave VITE_API_URL unset.',
      });
      return;
    }
    process.env.DATABASE_URL = process.env.DATABASE_URL || url;
    loading ??= import('../server/dist/serverless.js').catch((error) => {
      loading = undefined;
      throw error;
    });
    const { default: serverless } = await loading;
    return serverless(req, res);
  } catch (error) {
    console.error('[api] startup failed:', error?.message || error);
    res.status(503).json({ ok: false, setup: true, error: publicError(error) });
  }
}
