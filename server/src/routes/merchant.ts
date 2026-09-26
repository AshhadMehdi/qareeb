import { Router } from 'express';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import {
  deliveryZones,
  orderEvents,
  orderItems,
  orders,
  products,
  promos,
  reviews,
  runnerProfiles,
  shopRunners,
  shops,
  users,
  type OrderStatus,
} from '../db/schema.js';
import { env } from '../env.js';
import { authUser, hashPassword, requireAuth, requireRole } from '../lib/auth.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound, ok, parseBody } from '../lib/errors.js';
import { defaultHours, distanceKm, isOpenNow, riderScore, roundKm } from '../lib/geo.js';
import { newId, slugify } from '../lib/ids.js';
import { ORDER_STATUS_COPY, promoAppliedMessage } from '../lib/messages.js';
import { notify } from '../lib/notify.js';
import { refundOrder } from '../lib/payments.js';
import { applyPromo, serviceFeeFor } from '../lib/pricing.js';
import { emit, orderRoom, shopRoom, userRoom } from '../lib/realtime.js';
import {
  addRunnerSchema,
  assignRunnerSchema,
  createShopSchema,
  productInputSchema,
  promoSchema,
  promoPreviewSchema,
  shopInputSchema,
  statusUpdateSchema,
  stockDeltaSchema,
  zoneInputSchema,
} from '../lib/schemas.js';
import { serializeOrder, serializeProduct, serializePromo, serializeRunner } from '../lib/serialize.js';
import { getSettings } from '../lib/settings.js';

export const merchantRouter = Router();
merchantRouter.use(requireAuth, requireRole('MERCHANT', 'ADMIN'));

const MAX_RINGS = 6;

/** Every merchant endpoint scopes to a shop the caller owns (admins may override). */
async function ownedShop(req: Parameters<typeof authUser>[0]) {
  const user = authUser(req);
  const db = await getDb();
  const override = req.query.shopId as string | undefined;
  if (user.role === 'ADMIN' && override) {
    const [row] = await db.select().from(shops).where(eq(shops.id, override)).limit(1);
    if (!row) throw notFound('Shop not found');
    return row;
  }
  const [row] = await db
    .select()
    .from(shops)
    .where(eq(shops.ownerId, user.id))
    .orderBy(asc(shops.createdAt))
    .limit(1);
  if (!row) throw notFound('Create your shop first — it takes two minutes');
  return row;
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['ON_THE_WAY', 'CANCELLED'],
  ON_THE_WAY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/* -------------------------------------------------------------------------- */
/* Shop profile, onboarding and hours                                         */
/* -------------------------------------------------------------------------- */

merchantRouter.get(
  '/shops',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const rows = await db
      .select()
      .from(shops)
      .where(user.role === 'ADMIN' ? sql`true` : eq(shops.ownerId, user.id));
    res.json(
      ok({
        shops: rows.map((shop) => ({
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
          category: shop.category,
          status: shop.status,
          isOpen: shop.isOpen,
          isPaused: shop.isPaused,
          addressLine: shop.addressLine,
          ratingAvg: shop.ratingAvg,
          ratingCount: shop.ratingCount,
          deliveryMode: shop.deliveryMode,
        })),
      }),
    );
  }),
);

merchantRouter.get(
  '/shop',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const shop = await ownedShop(req);
    const db = await getDb();
    const [zoneRows, productRows, reviewRows, runnerRows] = await Promise.all([
      db.select().from(deliveryZones).where(eq(deliveryZones.shopId, shop.id)).orderBy(deliveryZones.sortOrder),
      db.select().from(products).where(eq(products.shopId, shop.id)).orderBy(products.sortOrder),
      db
        .select({ review: reviews, customerName: users.name })
        .from(reviews)
        .leftJoin(users, eq(users.id, reviews.customerId))
        .where(eq(reviews.shopId, shop.id))
        .orderBy(desc(reviews.createdAt))
        .limit(10),
      db
        .select({ user: users, profile: runnerProfiles })
        .from(shopRunners)
        .innerJoin(users, eq(users.id, shopRunners.runnerId))
        .leftJoin(runnerProfiles, eq(runnerProfiles.userId, users.id))
        .where(eq(shopRunners.shopId, shop.id)),
    ]);

    res.json(
      ok({
        shop: { ...shop, openNow: shop.isOpen && !shop.isPaused && isOpenNow(shop.hours) },
        zones: zoneRows,
        products: productRows.map(serializeProduct),
        reviews: reviewRows.map((row) => ({
          id: row.review.id,
          shopRating: row.review.shopRating,
          runnerRating: row.review.runnerRating,
          comment: row.review.comment,
          customerName: row.customerName ?? 'Qareeb customer',
          createdAt: row.review.createdAt,
        })),
        runners: runnerRows.map((row) => serializeRunner(row.user, row.profile)),
        isOnboarded: Boolean(shop.addressLine && shop.lat && shop.lng),
        owner: { id: user.id, name: user.name, email: user.email },
      }),
    );
  }),
);

merchantRouter.post(
  '/shops',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const input = parseBody(createShopSchema, req.body);
    const db = await getDb();
    const existing = await db.select().from(shops).where(eq(shops.ownerId, user.id)).limit(1);
    if (existing.length) throw conflict('You already have a shop on Qareeb');

    const id = newId();
    const now = new Date().toISOString();
    await db.insert(shops).values({
      id,
      ownerId: user.id,
      name: input.name,
      slug: `${slugify(input.name)}-${id.slice(0, 4)}`,
      category: input.category,
      description: input.description ?? null,
      phone: input.phone ?? null,
      addressLine: input.addressLine,
      lat: input.lat,
      lng: input.lng,
      hours: input.hours ?? defaultHours(),
      prepTimeMin: input.prepTimeMin,
      minOrder: input.minOrder,
      status: 'APPROVED',
      deliveryMode: input.deliveryMode,
      tags: input.tags,
      city: 'Abbottabad',
      createdAt: now,
      updatedAt: now,
    });

    // default delivery rings so the shop can sell from the first order
    await db.insert(deliveryZones).values(
      [
        { name: 'Within 2 km', radiusKm: 2, fee: 60, freeAbove: 1500, etaMinutes: 20, sortOrder: 0 },
        { name: '2 – 4 km', radiusKm: 4, fee: 90, freeAbove: 2500, etaMinutes: 30, sortOrder: 1 },
        { name: '4 – 7 km', radiusKm: 7, fee: 140, freeAbove: null, etaMinutes: 45, sortOrder: 2 },
      ].map((zone) => ({ id: newId(), shopId: id, ...zone })),
    );

    const [row] = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
    res.status(201).json(ok({ shop: row }));
  }),
);

merchantRouter.patch(
  '/shop',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const input = parseBody(shopInputSchema, req.body);
    const db = await getDb();
    await db
      .update(shops)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(shops.id, shop.id));
    const [row] = await db.select().from(shops).where(eq(shops.id, shop.id)).limit(1);
    await emit(shopRoom(shop.id), 'shop:updated', { shopId: shop.id });
    res.json(ok({ shop: row }));
  }),
);

/* -------------------------------------------------------------------------- */
/* Delivery rings                                                             */
/* -------------------------------------------------------------------------- */

async function zonesFor(shopId: string) {
  const db = await getDb();
  return db.select().from(deliveryZones).where(eq(deliveryZones.shopId, shopId)).orderBy(deliveryZones.sortOrder);
}

merchantRouter.post(
  '/zones',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const input = parseBody(zoneInputSchema, req.body);
    const db = await getDb();
    const existing = await zonesFor(shop.id);
    if (existing.length >= MAX_RINGS) throw badRequest(`${MAX_RINGS} delivery rings is the maximum`);
    await db.insert(deliveryZones).values({
      id: newId(),
      shopId: shop.id,
      name: input.name,
      radiusKm: input.radiusKm,
      fee: input.fee,
      freeAbove: input.freeAbove ?? null,
      etaMinutes: input.etaMinutes,
      sortOrder: input.sortOrder || existing.length,
    });
    res.status(201).json(ok({ zones: await zonesFor(shop.id) }));
  }),
);

merchantRouter.patch(
  '/zones/:id',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const input = parseBody(zoneInputSchema.partial(), req.body);
    const db = await getDb();
    await db
      .update(deliveryZones)
      .set({
        ...input,
        freeAbove: input.freeAbove === undefined ? undefined : input.freeAbove ?? null,
      })
      .where(and(eq(deliveryZones.id, String(req.params.id)), eq(deliveryZones.shopId, shop.id)));
    res.json(ok({ zones: await zonesFor(shop.id) }));
  }),
);

merchantRouter.delete(
  '/zones/:id',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const db = await getDb();
    await db
      .delete(deliveryZones)
      .where(and(eq(deliveryZones.id, String(req.params.id)), eq(deliveryZones.shopId, shop.id)));
    res.json(ok({ zones: await zonesFor(shop.id) }));
  }),
);

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

merchantRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const db = await getDb();
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.shopId, shop.id))
      .orderBy(products.sortOrder, products.name);
    res.json(
      ok({
        products: rows.map(serializeProduct),
        lowStock: rows.filter((row) => row.stock <= 5).map((row) => ({ id: row.id, name: row.name, stock: row.stock })),
        categories: [...new Set(rows.map((row) => row.category))],
        outOfStock: rows.filter((row) => row.stock === 0).length,
      }),
    );
  }),
);

merchantRouter.post(
  '/products',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const input = parseBody(productInputSchema, req.body);
    const db = await getDb();
    const [count] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.shopId, shop.id));
    const id = newId();
    const now = new Date().toISOString();
    await db.insert(products).values({
      id,
      shopId: shop.id,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      unit: input.unit,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      imageUrl: input.imageUrl ?? null,
      emoji: input.emoji ?? null,
      stock: input.stock,
      isAvailable: input.isAvailable,
      isFeatured: input.isFeatured,
      sortOrder: count?.n ?? 0,
      createdAt: now,
      updatedAt: now,
    });
    const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    res.status(201).json(ok({ product: serializeProduct(row!) }));
  }),
);

merchantRouter.patch(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const input = parseBody(productInputSchema.partial(), req.body);
    const db = await getDb();
    await db
      .update(products)
      .set({
        ...input,
        description: input.description === undefined ? undefined : input.description ?? null,
        compareAtPrice: input.compareAtPrice === undefined ? undefined : input.compareAtPrice ?? null,
        imageUrl: input.imageUrl === undefined ? undefined : input.imageUrl ?? null,
        emoji: input.emoji === undefined ? undefined : input.emoji ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(products.id, String(req.params.id)), eq(products.shopId, shop.id)));
    const [row] = await db.select().from(products).where(eq(products.id, String(req.params.id))).limit(1);
    if (!row) throw notFound('Product not found');
    res.json(ok({ product: serializeProduct(row) }));
  }),
);

merchantRouter.post(
  '/products/:id/stock',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const { delta } = parseBody(stockDeltaSchema, req.body);
    const db = await getDb();
    await db
      .update(products)
      .set({ stock: sql`greatest(${products.stock} + ${delta}, 0)`, updatedAt: new Date().toISOString() })
      .where(and(eq(products.id, String(req.params.id)), eq(products.shopId, shop.id)));
    const [row] = await db.select().from(products).where(eq(products.id, String(req.params.id))).limit(1);
    if (!row) throw notFound('Product not found');
    res.json(ok({ product: serializeProduct(row) }));
  }),
);

merchantRouter.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const db = await getDb();
    await db.delete(products).where(and(eq(products.id, String(req.params.id)), eq(products.shopId, shop.id)));
    res.json(ok({ deleted: true }));
  }),
);

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

merchantRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const db = await getDb();
    const status = typeof req.query.status === 'string' ? req.query.status : 'ACTIVE';
    const filters = [eq(orders.shopId, shop.id)];
    if (status === 'ACTIVE') {
      filters.push(inArray(orders.status, ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY']));
    } else if (status !== 'ALL') {
      filters.push(eq(orders.status, status as OrderStatus));
    }

    const rows = await db
      .select()
      .from(orders)
      .where(and(...filters))
      .orderBy(desc(orders.createdAt))
      .limit(80);

    const [items, runners, customers] = await Promise.all([
      rows.length
        ? db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((row) => row.id)))
        : Promise.resolve([] as (typeof orderItems.$inferSelect)[]),
      (() => {
        const ids = [...new Set(rows.map((row) => row.runnerId).filter((id): id is string => Boolean(id)))];
        return ids.length
          ? db
              .select({ user: users, profile: runnerProfiles })
              .from(users)
              .leftJoin(runnerProfiles, eq(runnerProfiles.userId, users.id))
              .where(inArray(users.id, ids))
          : Promise.resolve([] as { user: typeof users.$inferSelect; profile: typeof runnerProfiles.$inferSelect | null }[]);
      })(),
      rows.length
        ? db
            .select({ id: users.id, name: users.name, phone: users.phone })
            .from(users)
            .where(inArray(users.id, [...new Set(rows.map((row) => row.customerId))]))
        : Promise.resolve([] as { id: string; name: string; phone: string | null }[]),
    ]);

    const runnerById = new Map(runners.map((row) => [row.user.id, row]));
    const customerById = new Map(customers.map((row) => [row.id, row]));

    const list = rows.map((order) =>
      serializeOrder(order, {
        items: items.filter((item) => item.orderId === order.id),
        customer: customerById.get(order.customerId) ?? null,
        runner: order.runnerId
          ? (() => {
              const found = runnerById.get(order.runnerId!);
              if (!found) return null;
              return {
                id: found.user.id,
                name: found.user.name,
                phone: found.user.phone,
                lat: found.profile?.lat ?? null,
                lng: found.profile?.lng ?? null,
              };
            })()
          : null,
      }),
    );

    res.json(
      ok({
        orders: list,
        counts: {
          pending: list.filter((order) => order.status === 'PENDING').length,
          preparing: list.filter((order) => ['ACCEPTED', 'PREPARING'].includes(order.status)).length,
          ready: list.filter((order) => order.status === 'READY').length,
          onTheWay: list.filter((order) => order.status === 'ON_THE_WAY').length,
          today: list.filter((order) => new Date(order.createdAt) >= new Date(new Date().setHours(0, 0, 0, 0))).length,
        },
      }),
    );
  }),
);

merchantRouter.post(
  '/orders/:id/status',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const input = parseBody(statusUpdateSchema, req.body);
    const actor = authUser(req);
    const db = await getDb();

    const [order] = await db.select().from(orders).where(eq(orders.id, String(req.params.id))).limit(1);
    if (!order) throw notFound('Order not found');
    if (order.shopId !== shop.id && actor.role !== 'ADMIN') throw forbidden('That order belongs to another shop');

    const next = input.status as OrderStatus;
    if (!ALLOWED_TRANSITIONS[order.status].includes(next)) {
      throw conflict(`An order that is ${order.status.toLowerCase()} cannot move to ${next.toLowerCase()}`);
    }

    const at = new Date().toISOString();
    const patch: Partial<typeof orders.$inferInsert> = {
      status: next,
      updatedAt: at,
      statusHistory: [
        ...(order.statusHistory ?? []),
        { status: next, at, note: input.note ?? input.reason ?? undefined },
      ],
    };
    if (next === 'ACCEPTED') patch.acceptedAt = at;
    if (next === 'READY') patch.readyAt = at;
    if (next === 'DELIVERED') patch.deliveredAt = at;
    if (next === 'CANCELLED') {
      patch.cancelledAt = at;
      patch.cancelledBy = actor.id;
      patch.cancelReason = input.reason ?? 'Cancelled by the shop';
    }

    await db.update(orders).set(patch).where(eq(orders.id, order.id));
    await db.insert(orderEvents).values({
      id: newId(),
      orderId: order.id,
      status: next,
      note: input.note ?? input.reason ?? null,
      actorId: actor.id,
      actorRole: actor.role,
      createdAt: at,
    });

    if (next === 'CANCELLED') {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      for (const item of items) {
        if (!item.productId) continue;
        await db
          .update(products)
          .set({ stock: sql`${products.stock} + ${item.quantity}` })
          .where(eq(products.id, item.productId));
      }
      await refundOrder(order.id, patch.cancelReason as string, order.customerId);
    }

    if (next === 'DELIVERED') {
      const [customer] = await db.select().from(users).where(eq(users.id, order.customerId)).limit(1);
      if (customer && order.pointsEarned) {
        await db
          .update(users)
          .set({ walletPoints: customer.walletPoints + order.pointsEarned, updatedAt: at })
          .where(eq(users.id, customer.id));
      }
      const { creditReferralOnDelivery } = await import('../lib/referral.js');
      await creditReferralOnDelivery({ ...order, status: 'DELIVERED' });
    }

    if (next === 'DELIVERED' && order.runnerId) {
      const [profile] = await db
        .select()
        .from(runnerProfiles)
        .where(eq(runnerProfiles.userId, order.runnerId))
        .limit(1);
      if (profile) {
        await db
          .update(runnerProfiles)
          .set({
            totalDeliveries: profile.totalDeliveries + 1,
            cashInHand: order.paymentMethod === 'COD' ? profile.cashInHand + order.total : profile.cashInHand,
          })
          .where(eq(runnerProfiles.userId, profile.userId));
      }
    }

    await notify({
      userId: order.customerId,
      title: ORDER_STATUS_COPY[next],
      body:
        next === 'DELIVERED'
          ? `Order ${order.orderNumber} was delivered. ${order.pointsEarned} points landed in your wallet.`
          : `Order ${order.orderNumber} from ${shop.name}`,
      type: 'order',
      data: { orderId: order.id, status: next },
    });
    await emit([userRoom(order.customerId), orderRoom(order.id), shopRoom(shop.id)], 'order:updated', {
      orderId: order.id,
      status: next,
    });

    res.json(ok({ status: next }));
  }),
);

merchantRouter.post(
  '/orders/:id/assign',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const { runnerId } = parseBody(assignRunnerSchema, req.body);
    const actor = authUser(req);
    const db = await getDb();

    const [order] = await db.select().from(orders).where(eq(orders.id, String(req.params.id))).limit(1);
    if (!order) throw notFound('Order not found');
    if (order.shopId !== shop.id && actor.role !== 'ADMIN') throw forbidden('That order belongs to another shop');
    if (['DELIVERED', 'CANCELLED'].includes(order.status)) throw conflict('This order is already closed');

    let chosenId = runnerId;
    if (runnerId === 'auto') {
      const candidates = await db
        .select({ user: users, profile: runnerProfiles })
        .from(users)
        .innerJoin(runnerProfiles, eq(runnerProfiles.userId, users.id))
        .where(and(eq(users.role, 'RIDER'), eq(users.isActive, true), eq(runnerProfiles.isAvailable, true)));
      if (!candidates.length) throw badRequest('No riders are online right now');

      const team = await db.select().from(shopRunners).where(eq(shopRunners.shopId, shop.id));
      const teamIds = new Set(team.map((row) => row.runnerId));
      const loads = await db
        .select({ runnerId: orders.runnerId, count: sql<number>`count(*)::int` })
        .from(orders)
        .where(inArray(orders.status, ['ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY']))
        .groupBy(orders.runnerId);
      const loadByRunner = new Map(loads.map((row) => [row.runnerId ?? '', row.count]));

      const scored = candidates
        .map((candidate) => ({
          id: candidate.user.id,
          score: riderScore({
            riderLat: candidate.profile.lat,
            riderLng: candidate.profile.lng,
            shopLat: shop.lat,
            shopLng: shop.lng,
            activeOrders: loadByRunner.get(candidate.user.id) ?? 0,
            isTeamMember: teamIds.has(candidate.user.id),
          }),
        }))
        .sort((a, b) => a.score - b.score);
      chosenId = scored[0]!.id;
    } else {
      const [runner] = await db.select().from(users).where(eq(users.id, runnerId)).limit(1);
      if (!runner || runner.role !== 'RIDER') throw badRequest('That account is not a rider');
    }

    const at = new Date().toISOString();
    await db
      .update(orders)
      .set({
        runnerId: chosenId,
        updatedAt: at,
        statusHistory: [...(order.statusHistory ?? []), { status: order.status, at, note: 'Rider assigned' }],
      })
      .where(eq(orders.id, order.id));
    await db.insert(orderEvents).values({
      id: newId(),
      orderId: order.id,
      status: order.status,
      note: 'Rider assigned',
      actorId: actor.id,
      actorRole: actor.role,
      createdAt: at,
    });

    const [runner] = await db.select().from(users).where(eq(users.id, chosenId)).limit(1);
    await notify({
      userId: chosenId,
      title: 'New delivery assigned',
      body: `Pick up from ${shop.name}, ${shop.addressLine}. ${
        order.paymentMethod === 'COD' ? `Rs ${Math.round(order.total)} cash to collect.` : 'Already paid online.'
      }`,
      type: 'order',
      data: { orderId: order.id },
    });
    await notify({
      userId: order.customerId,
      title: runner ? `${runner.name} is your rider` : 'A rider was assigned',
      body: 'Track the delivery live from the order screen.',
      type: 'order',
      data: { orderId: order.id },
    });
    await emit([orderRoom(order.id), userRoom(order.customerId), userRoom(chosenId)], 'order:updated', {
      orderId: order.id,
      status: order.status,
      runnerId: chosenId,
    });

    res.json(ok({ runnerId: chosenId, runner: runner ? { id: runner.id, name: runner.name } : null }));
  }),
);

/* -------------------------------------------------------------------------- */
/* Riders                                                                     */
/* -------------------------------------------------------------------------- */

merchantRouter.get(
  '/runners',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const db = await getDb();
    const [team, platformRiders, loads] = await Promise.all([
      db
        .select({ user: users, profile: runnerProfiles })
        .from(shopRunners)
        .innerJoin(users, eq(users.id, shopRunners.runnerId))
        .leftJoin(runnerProfiles, eq(runnerProfiles.userId, users.id))
        .where(eq(shopRunners.shopId, shop.id)),
      db
        .select({ user: users, profile: runnerProfiles })
        .from(users)
        .innerJoin(runnerProfiles, eq(runnerProfiles.userId, users.id))
        .where(eq(users.role, 'RIDER')),
      db
        .select({ runnerId: orders.runnerId, count: sql<number>`count(*)::int` })
        .from(orders)
        .where(inArray(orders.status, ['ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY']))
        .groupBy(orders.runnerId),
    ]);

    const loadByRunner = new Map(loads.map((row) => [row.runnerId ?? '', row.count]));
    const decorate = (row: { user: typeof users.$inferSelect; profile: typeof runnerProfiles.$inferSelect | null }) =>
      serializeRunner(row.user, row.profile, {
        activeOrders: loadByRunner.get(row.user.id) ?? 0,
        distanceKm:
          row.profile?.lat != null && row.profile?.lng != null
            ? roundKm(distanceKm({ lat: row.profile.lat, lng: row.profile.lng }, { lat: shop.lat, lng: shop.lng }))
            : null,
      });

    const teamIds = new Set(team.map((row) => row.user.id));
    res.json(
      ok({
        team: team.map(decorate),
        nearby: platformRiders
          .filter((row) => !teamIds.has(row.user.id))
          .map(decorate)
          .sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99)),
      }),
    );
  }),
);

merchantRouter.post(
  '/runners',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const input = parseBody(addRunnerSchema, req.body);
    const db = await getDb();
    let [runner] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

    if (!runner) {
      const id = newId();
      const now = new Date().toISOString();
      await db.insert(users).values({
        id,
        email: input.email,
        name: input.name ?? input.email.split('@')[0] ?? 'Qareeb rider',
        role: 'RIDER',
        passwordHash: await hashPassword(env.demoPassword),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(runnerProfiles).values({ userId: id, vehicleType: 'bike', isAvailable: false, createdAt: now });
      [runner] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      await notify({
        userId: id,
        title: `${shop.name} added you as a rider`,
        body: 'Sign in with your email to start accepting deliveries.',
        type: 'info',
      });
    } else if (runner.role !== 'RIDER') {
      throw badRequest('That email belongs to a non-rider account');
    }

    const runnerId = runner!.id;
    const existing = await db
      .select()
      .from(shopRunners)
      .where(and(eq(shopRunners.shopId, shop.id), eq(shopRunners.runnerId, runnerId)))
      .limit(1);
    if (!existing.length) {
      await db
        .insert(shopRunners)
        .values({ id: newId(), shopId: shop.id, runnerId, createdAt: new Date().toISOString() });
    }
    res.status(201).json(ok({ runner: { id: runnerId, name: runner!.name, email: runner!.email } }));
  }),
);

merchantRouter.delete(
  '/runners/:runnerId',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const db = await getDb();
    await db
      .delete(shopRunners)
      .where(and(eq(shopRunners.shopId, shop.id), eq(shopRunners.runnerId, String(req.params.runnerId))));
    res.json(ok({ removed: true }));
  }),
);

/* -------------------------------------------------------------------------- */
/* Promos                                                                     */
/* -------------------------------------------------------------------------- */

merchantRouter.get(
  '/promos',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const db = await getDb();
    const rows = await db.select().from(promos).where(eq(promos.shopId, shop.id)).orderBy(desc(promos.createdAt));
    res.json(ok({ promos: rows.map(serializePromo) }));
  }),
);

merchantRouter.post(
  '/promos',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const input = parseBody(promoSchema, req.body);
    const db = await getDb();
    const existing = await db.select().from(promos).where(eq(promos.code, input.code)).limit(1);
    if (existing.length) throw conflict(`Promo code ${input.code} already exists`);
    const id = newId();
    await db.insert(promos).values({
      id,
      code: input.code,
      shopId: shop.id,
      title: input.title ?? null,
      type: input.type,
      value: input.value,
      minOrder: input.minOrder,
      maxDiscount: input.maxDiscount ?? null,
      expiresAt: input.expiresAt ?? null,
      usageLimit: input.usageLimit ?? null,
      usedCount: 0,
      isActive: input.isActive,
      createdAt: new Date().toISOString(),
    });
    const [row] = await db.select().from(promos).where(eq(promos.id, id)).limit(1);
    res.status(201).json(ok({ promo: serializePromo(row!) }));
  }),
);

merchantRouter.patch(
  '/promos/:id',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const input = parseBody(promoSchema.partial(), req.body);
    const db = await getDb();
    await db
      .update(promos)
      .set({
        ...input,
        maxDiscount: input.maxDiscount === undefined ? undefined : input.maxDiscount ?? null,
        expiresAt: input.expiresAt === undefined ? undefined : input.expiresAt ?? null,
        usageLimit: input.usageLimit === undefined ? undefined : input.usageLimit ?? null,
      })
      .where(and(eq(promos.id, String(req.params.id)), eq(promos.shopId, shop.id)));
    const [row] = await db.select().from(promos).where(eq(promos.id, String(req.params.id))).limit(1);
    if (!row) throw notFound('Promo not found');
    res.json(ok({ promo: serializePromo(row) }));
  }),
);

merchantRouter.post(
  '/promos/preview',
  asyncHandler(async (req, res) => {
    await ownedShop(req);
    const input = parseBody(promoPreviewSchema, req.body);
    const db = await getDb();
    const [promo] = await db.select().from(promos).where(eq(promos.code, input.code.toUpperCase())).limit(1);
    if (!promo) throw notFound('No such promo code');
    const applied = applyPromo(promo, { subtotal: input.subtotal, deliveryFee: input.deliveryFee });
    const settings = await getSettings();
    res.json(
      ok({
        ...applied,
        serviceFee: serviceFeeFor(Math.max(0, input.subtotal - applied.discount), settings.serviceFeePct),
        message: promoAppliedMessage(promo.code, applied.discount),
      }),
    );
  }),
);

/* -------------------------------------------------------------------------- */
/* Analytics                                                                  */
/* -------------------------------------------------------------------------- */

merchantRouter.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    const shop = await ownedShop(req);
    const settings = await getSettings();
    const db = await getDb();
    const since = new Date(Date.now() - 13 * 86_400_000).toISOString();

    const rows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.shopId, shop.id), gte(orders.createdAt, since)));

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = rows.filter((row) => new Date(row.createdAt) >= startOfToday && row.status !== 'CANCELLED');

    const daily = new Map<string, { date: string; orders: number; revenue: number }>();
    for (let index = 13; index >= 0; index -= 1) {
      const key = new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10);
      daily.set(key, { date: key, orders: 0, revenue: 0 });
    }
    for (const row of rows) {
      if (row.status === 'CANCELLED') continue;
      const bucket = daily.get(String(row.createdAt).slice(0, 10));
      if (!bucket) continue;
      bucket.orders += 1;
      bucket.revenue += row.subtotal;
    }

    const delivered = rows.filter((row) => row.status === 'DELIVERED');
    const subtotal = delivered.reduce((sum, row) => sum + row.subtotal, 0);
    const commission = (subtotal * settings.commissionPct) / 100;

    const [productSales, lowStock] = await Promise.all([
      db
        .select({
          name: orderItems.name,
          quantity: sql<number>`sum(${orderItems.quantity})::int`,
          revenue: sql<number>`sum(${orderItems.total})::float`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(eq(orders.shopId, shop.id), inArray(orders.status, ['DELIVERED', 'ON_THE_WAY', 'READY'])))
        .groupBy(orderItems.name)
        .orderBy(sql`sum(${orderItems.quantity}) desc`)
        .limit(8),
      db
        .select()
        .from(products)
        .where(and(eq(products.shopId, shop.id), sql`${products.stock} <= 5`))
        .limit(10),
    ]);

    res.json(
      ok({
        today: {
          orders: today.length,
          revenue: today.reduce((sum, row) => sum + row.subtotal, 0),
          pending: rows.filter((row) => row.status === 'PENDING').length,
          onTheWay: rows.filter((row) => row.status === 'ON_THE_WAY').length,
        },
        window: {
          days: 14,
          orders: delivered.length,
          revenue: subtotal,
          commission: Math.round(commission),
          payout: Math.round(subtotal - commission),
          averageOrderValue: delivered.length ? Math.round(subtotal / delivered.length) : 0,
        },
        daily: [...daily.values()],
        byStatus: rows.reduce<Record<string, number>>((accumulator, row) => {
          accumulator[row.status] = (accumulator[row.status] ?? 0) + 1;
          return accumulator;
        }, {}),
        topProducts: productSales,
        lowStock: lowStock.map(serializeProduct),
        settings: { commissionPct: settings.commissionPct, serviceFeePct: settings.serviceFeePct },
      }),
    );
  }),
);
