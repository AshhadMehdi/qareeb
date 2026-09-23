/**
 * Realtime without a socket server: append-only events, read back by an
 * authorized 5-second poll from the client.
 */
import { and, asc, gt, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { realtimeEvents } from '../db/schema.js';
import { newId } from './ids.js';

export type RealtimeEventName =
  | 'order:created'
  | 'order:updated'
  | 'notification'
  | 'chat:message'
  | 'rider:location'
  | 'shop:updated';

export const userRoom = (userId: string) => `user:${userId}`;
export const orderRoom = (orderId: string) => `order:${orderId}`;
export const shopRoom = (shopId: string) => `shop:${shopId}`;

export async function emit(
  rooms: string | string[],
  event: RealtimeEventName,
  payload: Record<string, unknown>,
): Promise<void> {
  const list = (Array.isArray(rooms) ? rooms : [rooms]).filter(Boolean);
  if (!list.length) return;
  const db = await getDb();
  await db.insert(realtimeEvents).values(
    list.map((room) => ({ id: undefined, room, event, payload, createdAt: new Date().toISOString() })),
  );
}

export async function readEvents(rooms: string[], since: number, limit = 100) {
  if (!rooms.length) return [];
  const db = await getDb();
  return db
    .select()
    .from(realtimeEvents)
    .where(and(inArray(realtimeEvents.room, rooms), gt(realtimeEvents.id, since)))
    .orderBy(asc(realtimeEvents.id))
    .limit(limit);
}

/** Drops events older than a day so the feed never grows without bound. */
export async function pruneEvents(): Promise<void> {
  const db = await getDb();
  await db.delete(realtimeEvents).where(sql`created_at < now() - interval '1 day'`);
}

export { newId };
