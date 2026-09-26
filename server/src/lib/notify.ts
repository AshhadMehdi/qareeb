import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { env } from '../env.js';
import { getDb } from '../db/client.js';
import { notifications, pushSubscriptions } from '../db/schema.js';
import { newId } from './ids.js';
import { emit, userRoom } from './realtime.js';

let pushReady = false;

function configurePush(): boolean {
  if (pushReady) return true;
  if (!env.vapid.publicKey || !env.vapid.privateKey) return false;
  try {
    webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
    pushReady = true;
    return true;
  } catch (error) {
    console.warn('[qareeb] web push disabled:', (error as Error).message);
    return false;
  }
}

export type NotifyInput = {
  userId: string;
  title: string;
  body: string;
  type?: 'info' | 'order' | 'chat' | 'promo' | 'system' | 'reward' | 'payout' | 'support';
  data?: Record<string, unknown>;
  /** skip the browser push, keep the in-app notification */
  silent?: boolean;
};

export async function notify(input: NotifyInput) {
  const db = await getDb();
  const row = {
    id: newId(),
    userId: input.userId,
    title: input.title,
    body: input.body,
    type: input.type ?? 'info',
    data: input.data ?? {},
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  await db.insert(notifications).values(row);
  await emit(userRoom(input.userId), 'notification', {
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type,
    data: row.data,
  });

  if (!input.silent) void sendPush(input.userId, row).catch(() => undefined);
  return row;
}

export async function sendPush(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, unknown> },
) {
  if (!configurePush()) return;
  const db = await getDb();
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: payload.title, body: payload.body, data: payload.data ?? {} }),
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
      }
    }),
  );
}

export function vapidPublicKey(): string | null {
  return env.vapid.publicKey || null;
}
