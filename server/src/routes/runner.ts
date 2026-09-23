import { Router } from 'express';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/client.js';
import {
  orderEvents,
  orderItems,
  orders,
  runnerProfiles,
  shopRunners,
  shops,
  users,
  type OrderStatus,
} from '../db/schema.js';
import { authUser, requireAuth, requireRole } from '../lib/auth.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound, ok, parseBody } from '../lib/errors.js';
import { distanceKm, roundKm } from '../lib/geo.js';
import { newId } from '../lib/ids.js';
import { notify } from '../lib/notify.js';
import { emit, orderRoom, shopRoom, userRoom } from '../lib/realtime.js';
import { serializeOrder } from '../lib/serialize.js';

export const runnerRouter = Router();
runnerRouter.use(requireAuth, requireRole('RIDER', 'ADMIN'));

async function ensureProfile(userId: string) {
  const db = await getDb();
  let [profile] = await db.select().from(runnerProfiles).where(eq(runnerProfiles.userId, userId)).limit(1);
  if (!profile) {
    await db
      .insert(runnerProfiles)
      .values({ userId, vehicleType: 'bike', isAvailable: false, createdAt: new Date().toISOString() });
    [profile] = await db.select().from(runnerProfiles).where(eq(runnerProfiles.userId, userId)).limit(1);
  }
  return profile!;
}

/* profile ------------------------------------------------------------------ */

runnerRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const profile = await ensureProfile(user.id);
    res.json(
      ok({
        profile: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          vehicleType: profile.vehicleType,
          isAvailable: profile.isAvailable,
          lat: profile.lat,
          lng: profile.lng,
          ratingAvg: profile.ratingAvg,
          ratingCount: profile.ratingCount,
          totalDeliveries: profile.totalDeliveries,
          cashInHand: profile.cashInHand,
        },
      }),
    );
  }),
);

runnerRouter.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    await ensureProfile(user.id);
    const input = parseBody(
      z.object({
        isAvailable: z.boolean().optional(),
        vehicleType: z.enum(['bike', 'car', 'van', 'bicycle']).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        cashInHand: z.number().min(0).max(1_000_000).optional(),
      }),
      req.body,
    );
    const db = await getDb();
    await db
      .update(runnerProfiles)
      .set({
        ...input,
        ...(input.isAvailable !== undefined || input.lat !== undefined
          ? { lastSeenAt: new Date().toISOString() }
          : {}),
      })
      .where(eq(runnerProfiles.userId, user.id));
    const profile = await ensureProfile(user.id);
    res.json(ok({ profile }));
  }),
);

/** Called every few seconds while the rider app is open and online. */
runnerRouter.post(
  '/location',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const input = parseBody(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        heading: z.number().min(0).max(360).nullish(),
        orderId: z.string().min(1).nullish(),
      }),
      req.body,
    );
    await ensureProfile(user.id);
    const db = await getDb();
    const at = new Date().toISOString();
    await db
      .update(runnerProfiles)
      .set({ lat: input.lat, lng: input.lng, heading: input.heading ?? null, lastSeenAt: at })
      .where(eq(runnerProfiles.userId, user.id));

    // broadcast to every active delivery this rider is carrying
    const active = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.runnerId, user.id),
          inArray(orders.status, ['ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY']),
        ),
      );
    const rooms = active.flatMap((order) => [orderRoom(order.id), userRoom(order.customerId), shopRoom(order.shopId)]);
    await emit(rooms, 'rider:location', {
      runnerId: user.id,
      lat: input.lat,
      lng: input.lng,
      heading: input.heading ?? null,
      orderId: input.orderId ?? active[0]?.id ?? null,
      at,
    });

    res.json(ok({ recorded: true }));
  }),
);

/* deliveries --------------------------------------------------------------- */

runnerRouter.get(
  '/deliveries',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const view = typeof req.query.view === 'string' ? req.query.view : 'active';

    const statusFilter =
      view === 'history'
        ? inArray(orders.status, ['DELIVERED', 'CANCELLED'])
        : inArray(orders.status, ['ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY']);

    const rows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.runnerId, user.id), statusFilter))
      .orderBy(desc(orders.createdAt))
      .limit(40);

    // Ready orders at shops this rider belongs to, not yet assigned — claimable.
    const teamShops = await db.select().from(shopRunners).where(eq(shopRunners.runnerId, user.id));
    const teamShopIds = teamShops.map((row) => row.shopId);
    const available = teamShopIds.length
      ? await db
          .select()
          .from(orders)
          .where(and(inArray(orders.shopId, teamShopIds), eq(orders.status, 'READY'), sql`${orders.runnerId} is null`))
          .orderBy(desc(orders.createdAt))
          .limit(20)
      : [];

    const all = [...rows, ...available];
    const items = all.length
      ? await db.select().from(orderItems).where(inArray(orderItems.orderId, all.map((row) => row.id)))
      : [];
    const shopRows = all.length
      ? await db.select().from(shops).where(inArray(shops.id, [...new Set(all.map((row) => row.shopId))]))
      : [];
    const customers = all.length
      ? await db
          .select({ id: users.id, name: users.name, phone: users.phone })
          .from(users)
          .where(inArray(users.id, [...new Set(all.map((row) => row.customerId))]))
      : [];

    const shopById = new Map(shopRows.map((row) => [row.id, row]));
    const customerById = new Map(customers.map((row) => [row.id, row]));

    const decorate = (order: typeof orders.$inferSelect) =>
      serializeOrder(order, {
        items: items.filter((item) => item.orderId === order.id),
        shop: shopById.get(order.shopId) ?? null,
        customer: customerById.get(order.customerId) ?? null,
      });

    res.json(
      ok({
        active: rows.filter((row) => row.status !== 'DELIVERED').map(decorate),
        history: rows.filter((row) => row.status === 'DELIVERED').map(decorate),
        available: available.map(decorate),
      }),
    );
  }),
);

runnerRouter.post(
  '/deliveries/:id/accept',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, String(req.params.id))).limit(1);
    if (!order) throw notFound('Order not found');
    if (order.runnerId && order.runnerId !== user.id) throw conflict('Another rider already took this delivery');
    if (['DELIVERED', 'CANCELLED'].includes(order.status)) throw conflict('This delivery is already closed');

    const at = new Date().toISOString();
    await db
      .update(orders)
      .set({
        runnerId: user.id,
        updatedAt: at,
        statusHistory: [...(order.statusHistory ?? []), { status: order.status, at, note: 'Rider accepted the job' }],
      })
      .where(eq(orders.id, order.id));
    await db.insert(orderEvents).values({
      id: newId(),
      orderId: order.id,
      status: order.status,
      note: 'Rider accepted the job',
      actorId: user.id,
      actorRole: 'RIDER',
      createdAt: at,
    });

    const [shop] = await db.select().from(shops).where(eq(shops.id, order.shopId)).limit(1);
    if (shop) {
      await notify({
        userId: shop.ownerId,
        title: `${user.name} accepted delivery ${order.orderNumber}`,
        body: order.paymentMethod === 'COD' ? `Rs ${Math.round(order.total)} cash to collect.` : 'Paid online.',
        type: 'order',
        data: { orderId: order.id },
      });
    }
    await notify({
      userId: order.customerId,
      title: `${user.name} is picking up your order`,
      body: 'Follow the rider live on the map.',
      type: 'order',
      data: { orderId: order.id },
    });
    await emit([orderRoom(order.id), userRoom(order.customerId)], 'order:updated', {
      orderId: order.id,
      runnerId: user.id,
      status: order.status,
    });

    res.json(ok({ accepted: true }));
  }),
);

runnerRouter.post(
  '/deliveries/:id/decline',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, String(req.params.id))).limit(1);
    if (!order) throw notFound('Order not found');
    if (order.runnerId !== user.id) throw forbidden('This delivery is not assigned to you');
    if (['ON_THE_WAY', 'DELIVERED'].includes(order.status)) {
      throw conflict('You already picked this order up — contact the shop instead');
    }

    const at = new Date().toISOString();
    await db
      .update(orders)
      .set({
        runnerId: null,
        updatedAt: at,
        statusHistory: [...(order.statusHistory ?? []), { status: order.status, at, note: 'Rider declined' }],
      })
      .where(eq(orders.id, order.id));
    await db.insert(orderEvents).values({
      id: newId(),
      orderId: order.id,
      status: order.status,
      note: 'Rider declined the job',
      actorId: user.id,
      actorRole: 'RIDER',
      createdAt: at,
    });

    const [shop] = await db.select().from(shops).where(eq(shops.id, order.shopId)).limit(1);
    if (shop) {
      await notify({
        userId: shop.ownerId,
        title: 'A rider declined a delivery',
        body: `Order ${order.orderNumber} needs another rider.`,
        type: 'order',
        data: { orderId: order.id },
      });
      await emit([shopRoom(shop.id), orderRoom(order.id)], 'order:updated', {
        orderId: order.id,
        runnerId: null,
        status: order.status,
      });
    }
    res.json(ok({ declined: true }));
  }),
);

runnerRouter.post(
  '/deliveries/:id/status',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const input = parseBody(
      z.object({
        status: z.enum(['ON_THE_WAY', 'DELIVERED']),
        note: z.string().max(200).nullish(),
        cashCollected: z.number().min(0).max(1_000_000).nullish(),
      }),
      req.body,
    );
    const db = await getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, String(req.params.id))).limit(1);
    if (!order) throw notFound('Order not found');
    if (order.runnerId !== user.id) throw forbidden('This delivery is not assigned to you');

    const next = input.status as OrderStatus;
    if (next === 'ON_THE_WAY' && !['READY', 'ACCEPTED', 'PREPARING'].includes(order.status)) {
      throw conflict(`An order that is ${order.status.toLowerCase()} cannot be picked up`);
    }
    if (next === 'DELIVERED' && order.status !== 'ON_THE_WAY') {
      throw badRequest('Mark the order as picked up before delivering it');
    }

    const at = new Date().toISOString();
    await db
      .update(orders)
      .set({
        status: next,
        updatedAt: at,
        ...(next === 'ON_THE_WAY' ? { pickedUpAt: at } : {}),
        ...(next === 'DELIVERED' ? { deliveredAt: at } : {}),
        ...(next === 'DELIVERED' && order.paymentMethod === 'COD' ? { paymentStatus: 'PAID' as const } : {}),
        statusHistory: [...(order.statusHistory ?? []), { status: next, at, note: input.note ?? undefined }],
      })
      .where(eq(orders.id, order.id));

    await db.insert(orderEvents).values({
      id: newId(),
      orderId: order.id,
      status: next,
      note: input.note ?? (next === 'ON_THE_WAY' ? 'Rider picked up the order' : 'Delivered to the customer'),
      actorId: user.id,
      actorRole: 'RIDER',
      createdAt: at,
    });

    if (next === 'DELIVERED') {
      const [profile] = await db.select().from(runnerProfiles).where(eq(runnerProfiles.userId, user.id)).limit(1);
      if (profile) {
        await db
          .update(runnerProfiles)
          .set({
            totalDeliveries: profile.totalDeliveries + 1,
            cashInHand:
              order.paymentMethod === 'COD'
                ? Math.max(0, profile.cashInHand + (input.cashCollected ?? order.total) - order.tip)
                : profile.cashInHand,
          })
          .where(eq(runnerProfiles.userId, user.id));
      }

      const [customer] = await db.select().from(users).where(eq(users.id, order.customerId)).limit(1);
      if (customer) {
        await db
          .update(users)
          .set({
            walletPoints: customer.walletPoints + order.pointsEarned,
            updatedAt: at,
          })
          .where(eq(users.id, customer.id));
      }
      await notify({
        userId: order.customerId,
        title: 'Delivered — enjoy your order',
        body: `${order.pointsEarned} points added to your wallet. Rate the shop and rider when you have a minute.`,
        type: 'order',
        data: { orderId: order.id },
      });
    }

    const [shop] = await db.select().from(shops).where(eq(shops.id, order.shopId)).limit(1);
    await notify({
      userId: shop?.ownerId ?? order.customerId,
      title: next === 'ON_THE_WAY' ? `Order ${order.orderNumber} picked up` : `Order ${order.orderNumber} delivered`,
      body: next === 'ON_THE_WAY' ? `${user.name} is heading to the customer.` : 'Delivery complete.',
      type: 'order',
      data: { orderId: order.id },
    });
    await emit(
      [orderRoom(order.id), userRoom(order.customerId), ...(shop ? [shopRoom(shop.id)] : [])],
      'order:updated',
      { orderId: order.id, status: next },
    );

    res.json(ok({ status: next }));
  }),
);

/**
 * Demo helper: returns the shop → customer path plus waypoints so the rider app
 * can animate a ride. The rider client posts its position as it moves, which is
 * exactly what a real GPS feed does — customers see the same live map either way.
 */
runnerRouter.post(
  '/deliveries/:id/simulate',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, String(req.params.id))).limit(1);
    if (!order) throw notFound('Order not found');
    if (order.runnerId !== user.id) throw forbidden('This delivery is not assigned to you');

    const [shop] = await db.select().from(shops).where(eq(shops.id, order.shopId)).limit(1);
    if (!shop) throw notFound('Shop not found');

    const from = { lat: shop.lat, lng: shop.lng };
    const to = { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng };
    const steps = 24;
    const waypoints = Array.from({ length: steps + 1 }, (_, index) => {
      const t = index / steps;
      // a slight arc so the path reads like a road, not a ruler
      const curve = Math.sin(t * Math.PI) * 0.0015;
      return {
        lat: from.lat + (to.lat - from.lat) * t + curve,
        lng: from.lng + (to.lng - from.lng) * t - curve,
      };
    });

    res.json(
      ok({
        orderId: order.id,
        distanceKm: roundKm(distanceKm(from, to)),
        waypoints,
        stepSeconds: 3,
        destination: { ...to, line1: order.deliveryAddress.line1, area: order.deliveryAddress.area },
      }),
    );
  }),
);

/* earnings ----------------------------------------------------------------- */

runnerRouter.get(
  '/earnings',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const weekAgo = new Date(startOfDay.getTime() - 6 * 86_400_000);
    const monthAgo = new Date(startOfDay.getTime() - 29 * 86_400_000);

    const rows = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.runnerId, user.id),
          eq(orders.status, 'DELIVERED'),
          gte(orders.deliveredAt, monthAgo.toISOString()),
        ),
      )
      .orderBy(desc(orders.deliveredAt));

    const earning = (row: typeof orders.$inferSelect) => row.deliveryFee + row.tip;
    const sum = (list: typeof rows) => list.reduce((total, row) => total + earning(row), 0);

    const daily = new Map<string, number>();
    for (let index = 6; index >= 0; index -= 1) {
      const key = new Date(startOfDay.getTime() - index * 86_400_000).toISOString().slice(0, 10);
      daily.set(key, 0);
    }
    for (const row of rows) {
      const key = String(row.deliveredAt ?? row.createdAt).slice(0, 10);
      if (daily.has(key)) daily.set(key, (daily.get(key) ?? 0) + earning(row));
    }

    const [profile] = await db.select().from(runnerProfiles).where(eq(runnerProfiles.userId, user.id)).limit(1);
    res.json(
      ok({
        today: sum(rows.filter((row) => new Date(row.deliveredAt ?? row.createdAt) >= startOfDay)),
        week: sum(rows.filter((row) => new Date(row.deliveredAt ?? row.createdAt) >= weekAgo)),
        month: sum(rows),
        deliveries: {
          today: rows.filter((row) => new Date(row.deliveredAt ?? row.createdAt) >= startOfDay).length,
          week: rows.filter((row) => new Date(row.deliveredAt ?? row.createdAt) >= weekAgo).length,
          month: rows.length,
        },
        tips: rows.reduce((total, row) => total + row.tip, 0),
        cashInHand: profile?.cashInHand ?? 0,
        daily: [...daily.entries()].map(([date, amount]) => ({ date, amount })),
        recent: rows.slice(0, 10).map((row) => ({
          id: row.id,
          orderNumber: row.orderNumber,
          deliveredAt: row.deliveredAt,
          earned: earning(row),
          tip: row.tip,
        })),
      }),
    );
  }),
);
