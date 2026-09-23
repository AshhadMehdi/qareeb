import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { settings } from '../db/schema.js';
import { DEFAULT_SETTINGS, type PlatformSettings } from './pricing.js';

let cache: { value: PlatformSettings; at: number } | null = null;
const TTL_MS = 15_000;

export async function getSettings(force = false): Promise<PlatformSettings> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const db = await getDb();
  const rows = await db.select().from(settings);
  const merged: PlatformSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in merged) {
      (merged as Record<string, unknown>)[row.key] = row.value;
    }
  }
  cache = { value: merged, at: Date.now() };
  return merged;
}

export async function updateSettings(
  patch: Partial<PlatformSettings>,
  actorId?: string,
): Promise<PlatformSettings> {
  const db = await getDb();
  const entries = Object.entries(patch).filter(([key]) => key in DEFAULT_SETTINGS);
  for (const [key, value] of entries) {
    await db
      .insert(settings)
      .values({ key, value, updatedBy: actorId ?? null, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedBy: actorId ?? null, updatedAt: new Date().toISOString() },
      });
  }
  cache = null;
  return getSettings(true);
}

export async function readSetting<T>(key: keyof PlatformSettings): Promise<T> {
  const all = await getSettings();
  return all[key] as T;
}

export async function settingsByKeys(keys: (keyof PlatformSettings)[]) {
  const all = await getSettings();
  const out: Partial<PlatformSettings> = {};
  for (const key of keys) out[key] = all[key] as never;
  return out;
}

export { inArray, eq };
