/**
 * Login throttling that survives serverless instance churn: counters live in
 * Postgres (api_rate_limits). If the table is unreachable we fail open rather
 * than locking everybody out, and log the reason.
 */
import { getHandle } from '../db/client.js';

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const handle = await getHandle();
    const rows = await handle.query<{ hits: number; reset_at: string }>(
      `insert into api_rate_limits (key, hits, reset_at)
       values ($1, 1, now() + ($2 || ' seconds')::interval)
       on conflict (key) do update set
         hits = case when api_rate_limits.reset_at < now() then 1 else api_rate_limits.hits + 1 end,
         reset_at = case when api_rate_limits.reset_at < now() then now() + ($2 || ' seconds')::interval else api_rate_limits.reset_at end
       returning hits, reset_at`,
      [key, String(windowSeconds)],
    );
    const row = rows[0];
    if (!row) return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
    const hits = Number(row.hits);
    const retryAfterSeconds = Math.max(0, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000));
    return { allowed: hits <= limit, remaining: Math.max(0, limit - hits), retryAfterSeconds };
  } catch (error) {
    console.warn('[qareeb] rate limit store unavailable:', (error as Error).message);
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

export async function clearRateLimit(key: string): Promise<void> {
  try {
    const handle = await getHandle();
    await handle.query('delete from api_rate_limits where key = $1', [key]);
  } catch {
    /* best effort */
  }
}

export async function pruneRateLimits(): Promise<void> {
  try {
    const handle = await getHandle();
    await handle.exec(`delete from api_rate_limits where reset_at < now() - interval '1 hour'`);
  } catch {
    /* best effort */
  }
}
