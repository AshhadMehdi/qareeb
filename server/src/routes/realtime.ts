import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders, shopRunners, shops } from '../db/schema.js';
import { authUser, requireAuth } from '../lib/auth.js';
import { asyncHandler, ok } from '../lib/errors.js';
import { orderRoom, pruneEvents, readEvents, shopRoom, userRoom } from '../lib/realtime.js';

export const realtimeRouter = Router();

/**
 * Authorized event feed. The client polls this every five seconds while the tab
 * is visible and passes back the highest id it has already seen, so a reconnect
 * never replays or misses events.
 */
realtimeRouter.get(
  '/events',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const since = Number(req.query.since ?? 0) || 0;
    const db = await getDb();

    const rooms = [userRoom(user.id)];

    if (user.role === 'MERCHANT') {
      const owned = await db.select({ id: shops.id }).from(shops).where(eq(shops.ownerId, user.id));
      rooms.push(...owned.map((shop) => shopRoom(shop.id)));
    }
    if (user.role === 'RIDER') {
      const team = await db.select().from(shopRunners).where(eq(shopRunners.runnerId, user.id));
      rooms.push(...team.map((row) => shopRoom(row.shopId)));
    }

    // order rooms keep chat and status changes flowing to the right people
    const relevantOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        user.role === 'ADMIN'
          ? sql`true`
          : user.role === 'CUSTOMER'
            ? eq(orders.customerId, user.id)
            : user.role === 'RIDER'
              ? eq(orders.runnerId, user.id)
              : inArray(
                  orders.shopId,
                  (await db.select({ id: shops.id }).from(shops).where(eq(shops.ownerId, user.id))).map(
                    (shop) => shop.id,
                  ),
                ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(40);
    rooms.push(...relevantOrders.map((order) => orderRoom(order.id)));

    const events = await readEvents(rooms, since);
    if (since === 0 && events.length > 400) void pruneEvents();

    res.json(
      ok({
        events: events.map((event) => ({
          id: event.id,
          room: event.room,
          event: event.event,
          payload: event.payload,
          createdAt: event.createdAt,
        })),
        cursor: events.length ? events[events.length - 1]!.id : since,
        serverTime: new Date().toISOString(),
      }),
    );
  }),
);
