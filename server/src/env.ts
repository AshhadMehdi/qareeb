import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
// src/ during development, dist/ after a build — .env sits one level up either way.
const serverRoot = path.resolve(here, '..');

for (const candidate of [
  path.join(serverRoot, '.env'),
  path.join(serverRoot, '..', '.env'),
]) {
  if (fs.existsSync(candidate)) dotenv.config({ path: candidate, quiet: true });
}

const DATABASE_URL_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'NEON_DATABASE_URL',
] as const;

function firstDatabaseUrl(): string {
  for (const key of DATABASE_URL_KEYS) {
    const value = process.env[key]?.trim();
    if (value && /^postgres(ql)?:\/\//i.test(value)) return value;
  }
  const host = process.env.PGHOST || process.env.POSTGRES_HOST;
  const user = process.env.PGUSER || process.env.POSTGRES_USER;
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
  if (host && user && password) {
    const database = process.env.PGDATABASE || process.env.POSTGRES_DATABASE || 'postgres';
    const port = process.env.PGPORT || process.env.POSTGRES_PORT || '5432';
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=require`;
  }
  return '';
}

export const isVercel = Boolean(process.env.VERCEL);
export const isProduction = process.env.NODE_ENV === 'production';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  appName: process.env.APP_NAME ?? 'Qareeb',
  isVercel,
  isProduction,
  /** empty string = no hosted database; local development falls back to PGlite */
  databaseUrl: firstDatabaseUrl(),
  localDatabasePath: process.env.LOCAL_DATABASE_PATH ?? '',
  autoSeed: process.env.AUTO_SEED !== 'false',
  demoPassword: process.env.DEMO_PASSWORD || 'password123',
  jwtSecret:
    process.env.JWT_SECRET?.trim() ||
    // On Vercel a missing secret must not crash the deploy: derive a stable one
    // from the database URL so sessions survive cold starts (and warn in logs).
    (firstDatabaseUrl()
      ? crypto.createHash('sha256').update(`qareeb:${firstDatabaseUrl()}`).digest('hex')
      : 'qareeb-local-development-secret-change-before-production'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL ?? 60 * 60 * 12),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  vapid: {
    subject: process.env.VAPID_SUBJECT ?? 'mailto:ops@qareeb.pk',
    publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
  },
  payments: {
    jazzcash: {
      merchantId: process.env.JAZZCASH_MERCHANT_ID ?? '',
      password: process.env.JAZZCASH_PASSWORD ?? '',
      integritySalt: process.env.JAZZCASH_INTEGRITY_SALT ?? '',
      mode: (process.env.JAZZCASH_ENV === 'live' ? 'live' : 'sandbox') as 'live' | 'sandbox',
    },
    easypaisa: {
      storeId: process.env.EASYPAISA_STORE_ID ?? '',
      hashKey: process.env.EASYPAISA_HASH_KEY ?? '',
      mode: (process.env.EASYPAISA_ENV === 'live' ? 'live' : 'sandbox') as 'live' | 'sandbox',
    },
  },
  /** hard cap on how big an uploaded image may be, in bytes */
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 3 * 1024 * 1024),
};

if (isVercel && !process.env.JWT_SECRET) {
  console.warn('[qareeb] JWT_SECRET is unset — derived a stable secret from DATABASE_URL. Set JWT_SECRET for production.');
}

export function hasHostedDatabase(): boolean {
  return Boolean(env.databaseUrl);
}

export function publicConfig() {
  return {
    appName: env.appName,
    city: 'Abbottabad',
    demoPassword: env.autoSeed ? env.demoPassword : null,
    googleClientId: env.googleClientId || null,
    pushEnabled: Boolean(env.vapid.publicKey && env.vapid.privateKey),
    currency: 'PKR',
    payments: {
      cod: true,
      jazzcash: true,
      easypaisa: true,
      wallet: true,
      card: false,
      mode: env.payments.jazzcash.mode,
    },
    defaultCenter: { lat: 34.1688, lng: 73.2215 },
  };
}
