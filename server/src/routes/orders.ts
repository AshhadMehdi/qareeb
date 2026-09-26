import { Router } from 'express';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import {
  addresses,
  deliveryZones,
  messages,
  orderEvents,
  orderItems,
  orders,
  products,
  promos,
  reviews,
  runnerProfiles,
  shops,
  users,
  type DeliveryAddressSnapshot,
  type PromoRow,
} from '../db/schema.js';
import { authUser, requireAuth } from '../lib/auth.js';
import { asyncHandler, badRequest, conflict, forbidden, notFound, ok, parseBody } from '../lib/errors.js';
import { newId, orderNumber } from '../lib/ids.js';
import { notify } from '../lib/notify.js';
import { refundOrder, settleOrderPayment } from '../lib/payments.js';
import { applyPromo, pointsFor, roundMoney, serviceFeeFor } from '../lib/pricing.js';
import { emit, orderRoom, shopRoom, userRoom } from '../lib/realtime.js';
import { checkoutSchema, messageSchema, reviewSchema, type CheckoutGroup } from '../lib/schemas.js';
import { serializeOrder } from '../lib/serialize.js';
import { getSettings } from '../lib/settings.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

type PreparedGroup = {
  group: CheckoutGroup;
  shop: typeof shops.$inferSelect;
  items: {
    id: string;
    productId: string;
    name: string;
    unit: string;
    unitPrice: number;
    quantity: number;
    total: number;
    note: string | null;
    emoji: string | null;
    imageUrl: string | null;
  }[];
  subtotal: number;
  zones: (typeof deliveryZones.$inferSelect)[];
  promo: PromoRow | null;
  warnings: string[];
};

/** Normalises a checkout/quote payload into per-shop baskets. */
async function prepareGroups(groups: CheckoutGroup[]): Promise<PreparedGroup[]> {
  const db = await getDb();
  const shopIds = [...new Set(groups.map((group) => group.shopId))];
  const shopRows = await db.select().from(shops).where(inArray(shops.id, shopIds));
  const shopsById = new Map(shopRows.map((shop) => [shop.id, shop]));

  const productIds = [...new Set(groups.flatMap((group) => group.items.map((item) => item.productId)))];
  const productRows = productIds.length
    ? await db.select().from(products).where(inArray(products.id, productIds))
    : [];
  const productsById = new Map(productRows.map((product) => [product.id, product]));

  const zoneRows = shopIds.length
    ? await db.select().from(deliveryZones).where(inArray(deliveryZones.shopId, shopIds))
    : [];

  const promoCodeList = [...new Set(groups.map((group) => group.promoCode?.toUpperCase()).filter(Boolean))] as string[];
  const promoRows = promoCodeList.length
    ? await db.select().from(promos).where(inArray(promos.code, promoCodeList))
    : [];
  const promosByCode = new Map(promoRows.map((promo) => [promo.code.toUpperCase(), promo]));

  const prepared: PreparedGroup[] = [];
  for (const group of groups) {
    const shop = shopsById.get(group.shopId);
    if (!shop) throw notFound('One of the shops in your cart is no longer available');
    if (shop.status !== 'APPROVED') throw badRequest(`${shop.name} is not accepting orders right now`);

    const warnings: string[] = [];
    const items: PreparedGroup['items'] = [];
    for (const line of group.items) {
      const product = productsById.get(line.productId);
      if (!product) {
        warnings.push('An item was removed by the shop');
        continue;
      }
      if (product.shopId !== shop.id) throw badRequest(`${product.name} does not belong to ${shop.name}`);
      if (!product.isAvailable) {
        warnings.push(`${product.name} is unavailable and was skipped`);
        continue;
      }
      if (product.stock < line.quantity) {
        warnings.push(`${product.name}: only ${product.stock} ${product.unit} left`);
        if (product.stock <= 0) continue;
      }
      const quantity = Math.min(line.quantity, Math.max(product.stock, 1));
      items.push({
        id: newId(),
        productId: product.id,
        name: product.name,
        unit: product.unit,
        unitPrice: product.price,
        quantity,
        total: roundMoney(product.price * quantity),
        note: line.note ?? null,
        emoji: product.emoji,
        imageUrl: product.imageUrl,
      });
    }
    if (!items.length) throw badRequest(`${shop.name} has nothing available from your basket`);

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    if (shop.minOrder > subtotal) {
      throw badRequest(`${shop.name} has a minimum order of Rs ${roundMoney(shop.minOrder)}`);
    }

    const promo = group.promoCode ? promosByCode.get(group.promoCode.toUpperCase()) ?? null : null;
    if (group.promoCode && !promo) throw badRequest(`Promo code ${group.promoCode} is not valid`);
    if (promo?.shopId && promo.shopId !== shop.id) {
      throw badRequest(`${promo.code} only works at one specific shop in your cart`);
    }

    prepared.push({
      group,
      shop,
      items,
      subtotal,
      zones: zoneRows.filter((zone) => zone.shopId === shop.id),
      promo,
      warnings,
    });
  }
  return prepared;
}

type InlineAddress = {
  label?: string;
  line1: string;
  area?: string | null;
  city?: string;
  lat: number;
  lng: number;
  landmark?: string | null;
  instructions?: string | null;
};

/** Saved address wins; a brand-new address typed at checkout is used as-is. */
function resolveAddressSnapshot(
  saved: typeof addresses.$inferSelect | null,
  inline: InlineAddress | undefined,
  phone: string | null,
): DeliveryAddressSnapshot {
  const source = saved ?? inline;
  if (!source) throw badRequest('Choose a delivery address');
  return {
    label: source.label ?? 'Home',
    line1: source.line1,
    area: source.area ?? null,
    city: source.city ?? 'Abbottabad',
    lat: source.lat,
    lng: source.lng,
    landmark: source.landmark ?? null,
    instructions: source.instructions ?? null,
    phone,
  };
}

type Totals = {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  tip: number;
  total: number;
  distanceKm: number;
  etaMinutes: number;
  freeDelivery: boolean;
  zoneName: string | null;
  deliverable: boolean;
  promoError?: string;
};

async function priceGroup(prepared: PreparedGroup, destination: { lat: number; lng: number }): Promise<Totals> {
  const settings = await getSettings();
  const { quoteZone } = await import('../lib/geo.js');
  const quote = quoteZone(prepared.shop, destination, prepared.zones, prepared.subtotal);

  let discount = 0;
  let freeDelivery = quote.freeDelivery;
  let promoError: string | undefined;
  if (prepared.promo) {
    try {
      const applied = applyPromo(prepared.promo, { subtotal: prepared.subtotal, deliveryFee: quote.fee });
      discount = applied.discount;
      freeDelivery = freeDelivery || applied.freeDelivery;
    } catch (error) {
      promoError = (error as Error).message;
    }
  }

  const deliveryFee = freeDelivery ? 0 : quote.fee;
  const serviceFee = serviceFeeFor(prepared.subtotal, settings.serviceFeePct);
  const tip = prepared.group.tip ?? 0;
  const total = Math.max(0, prepared.subtotal + deliveryFee + serviceFee - discount + tip);

  return {
    subtotal: prepared.subtotal,
    deliveryFee,
    serviceFee,
    discount,
    tip,
    total: roundMoney(total),
    distanceKm: quote.distanceKm,
    etaMinutes: quote.etaMinutes,
    freeDelivery,
    zoneName: quote.zone?.name ?? null,
    deliverable: quote.deliverable,
    promoError,
  };
}

/* quote -------------------------------------------------------------------- */

ordersRouter.post(
  '/quote',
  asyncHandler(async (req, res) => {
    const input = parseBody(checkoutSchema, req.body);
    const user = authUser(req);
    const db = await getDb();
    const settings = await getSettings();

    const saved = input.addressId
      ? (await db
          .select()
          .from(addresses)
          .where(and(eq(addresses.id, input.addressId), eq(addresses.userId, user.id)))
          .limit(1))[0] ?? null
      : null;
    if (input.addressId && !saved) throw notFound('That saved address no longer exists');

    const destination = saved
      ? { lat: saved.lat, lng: saved.lng }
      : input.address
        ? { lat: input.address.lat, lng: input.address.lng }
        : null;
    if (!destination) throw badRequest('Add a delivery address so we can price delivery');

    const prepared = await prepareGroups(input.groups);
    const groups = [];
    for (const group of prepared) {
      const totals = await priceGroup(group, destination);
      groups.push({
        shopId: group.shop.id,
        shop: { id: group.shop.id, name: group.shop.name, slug: group.shop.slug, category: group.shop.category },
        items: group.items,
        warnings: group.warnings,
        ...totals,
        pointsEarnable: pointsFor(totals.subtotal, settings.loyaltyPointsPer100),
      });
    }

    const total = groups.reduce((sum, group) => sum + group.total, 0);
    const maxRedeemable = Math.min(user.walletPoints, Math.floor(total));
    const usePoints = Math.min(input.usePoints ?? 0, maxRedeemable);

    res.json(
      ok({
        groups,
        summary: {
          subtotal: groups.reduce((sum, group) => sum + group.subtotal, 0),
          deliveryFee: groups.reduce((sum, group) => sum + group.deliveryFee, 0),
          serviceFee: groups.reduce((sum, group) => sum + group.serviceFee, 0),
          discount: groups.reduce((sum, group) => sum + group.discount, 0),
          tip: groups.reduce((sum, group) => sum + group.tip, 0),
          total: roundMoney(total),
        },
        destination,
        points: {
          available: user.walletPoints,
          maxRedeemable,
          applied: usePoints,
          payable: roundMoney(Math.max(0, total - usePoints)),
        },
        settings: {
          serviceFeePct: settings.serviceFeePct,
          cancelWindowMinutes: settings.cancelWindowMinutes,
          cityName: settings.cityName,
        },
        address: saved
          ? {
              id: saved.id,
              label: saved.label,
              line1: saved.line1,
              area: saved.area,
              city: saved.city,
              lat: saved.lat,
              lng: saved.lng,
              landmark: saved.landmark,
              instructions: saved.instructions,
            }
          : null,
      }),
    );
  }),
);

/* checkout ----------------------------------------------------------------- */

ordersRouter.post(
  '/checkout',
  asyncHandler(async (req, res) => {
    const input = parseBody(checkoutSchema, req.body);
    const user = authUser(req);
    const db = await getDb();
    const settings = await getSettings();

    const saved = input.addressId
      ? (await db
          .select()
          .from(addresses)
          .where(and(eq(addresses.id, input.addressId), eq(addresses.userId, user.id)))
          .limit(1))[0] ?? null
      : null;
    if (input.addressId && !saved) throw notFound('That saved address no longer exists');

    const snapshot = resolveAddressSnapshot(saved, input.address as InlineAddress | undefined, user.phone ?? null);
    const destination = { lat: snapshot.lat, lng: snapshot.lng };

    const prepared = await prepareGroups(input.groups);
    const priced = [] as { prepared: PreparedGroup; totals: Totals }[];
    for (const group of prepared) {
      const totals = await priceGroup(group, destination);
      if (!totals.deliverable) {
        throw badRequest(`${group.shop.name} does not deliver to ${snapshot.area ?? 'this address'} yet`);
      }
      if (totals.promoError) throw badRequest(totals.promoError);
      priced.push({ prepared: group, totals });
    }

    const grandTotal = priced.reduce((sum, entry) => sum + entry.totals.total, 0);
    const [currentUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const availablePoints = currentUser?.walletPoints ?? 0;
    let pointsToRedeem = Math.min(input.usePoints ?? 0, availablePoints, Math.floor(grandTotal));

    if (input.paymentMethod === 'WALLET' && availablePoints < grandTotal) {
      throw badRequest(
        `You have ${availablePoints} points. Choose cash on delivery or add another payment method.`,
      );
    }

    const groupId = newId();
    const created: {
      id: string;
      shopId: string;
      total: number;
      orderNumber: string;
      paymentStatus: string;
      paymentMessage: string;
    }[] = [];
    let pointsLeftToSpread = pointsToRedeem;

    for (const [index, entry] of priced.entries()) {
      const { prepared: group, totals } = entry;
      const isLast = index === priced.length - 1;
      const redeemForThisOrder = isLast
        ? pointsLeftToSpread
        : Math.min(pointsLeftToSpread, Math.floor(totals.total));
      pointsLeftToSpread -= redeemForThisOrder;

      const payable = Math.max(0, totals.total - redeemForThisOrder);
      const orderId = newId();
      const createdAt = new Date().toISOString();
      const needsAcceptance = true;
      const status = 'PENDING' as const;

      await db.insert(orders).values({
        id: orderId,
        orderNumber: orderNumber(),
        groupId,
        customerId: user.id,
        shopId: group.shop.id,
        status,
        paymentMethod: input.paymentMethod,
        paymentStatus: 'UNPAID',
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        serviceFee: totals.serviceFee,
        discount: totals.discount + redeemForThisOrder,
        tip: totals.tip,
        total: payable,
        distanceKm: roundMoney(totals.distanceKm * 10) / 10,
        etaMinutes: totals.etaMinutes,
        promoCode: group.promo?.code ?? null,
        notes: input.notes ?? group.group.note ?? null,
        deliveryAddress: snapshot,
        statusHistory: [
          { status, at: createdAt, note: needsAcceptance ? 'Order placed' : undefined },
        ],
        scheduledFor: input.scheduledFor ?? null,
        pointsRedeemed: redeemForThisOrder,
        pointsEarned: pointsFor(totals.subtotal, settings.loyaltyPointsPer100),
        createdAt,
        updatedAt: createdAt,
      });

      await db.insert(orderItems).values(group.items.map((item) => ({ ...item, orderId })));
      await db.insert(orderEvents).values({
        id: newId(),
        orderId,
        status,
        note: 'Order placed by the customer',
        actorId: user.id,
        actorRole: 'CUSTOMER',
        createdAt,
      });

      for (const item of group.items) {
        await db
          .update(products)
          .set({ stock: sql`greatest(${products.stock} - ${item.quantity}, 0)`, updatedAt: createdAt })
          .where(eq(products.id, item.productId));
      }

      if (group.promo) {
        await db
          .update(promos)
          .set({ usedCount: sql`${promos.usedCount} + 1` })
          .where(eq(promos.id, group.promo.id));
      }

      const payment = await settleOrderPayment({
        orderId,
        method: input.paymentMethod,
        amount: payable,
        actorId: user.id,
      });

      await notify({
        userId: group.shop.ownerId,
        title: `New order — Rs ${payable}`,
        body: `${group.items.length} item(s) for ${snapshot.area ?? 'Abbottabad'}. Accept to start preparing.`,
        type: 'order',
        data: { orderId, groupId },
      });
      await emit([shopRoom(group.shop.id), userRoom(user.id), orderRoom(orderId)], 'order:created', {
        orderId,
        groupId,
        shopId: group.shop.id,
        status,
        total: payable,
      });

      const [row] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      created.push({
        id: orderId,
        shopId: group.shop.id,
        total: payable,
        orderNumber: row!.orderNumber,
        paymentStatus: payment.status,
        paymentMessage: payment.message,
      });
    }

    if (pointsToRedeem > 0) {
      await db
        .update(users)
        .set({
          walletPoints: sql`greatest(${users.walletPoints} - ${pointsToRedeem}, 0)`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, user.id));
    }

    const detail = await loadGroupedOrders(groupId, user.id);
    res.status(201).json(
      ok({
        groupId,
        orders: detail,
        pointsRedeemed: pointsToRedeem,
        payment: { method: input.paymentMethod, results: created },
      }),
    );
  }),
);

/* helpers ------------------------------------------------------------------ */

async function loadGroupedOrders(groupId: string, viewerId: string) {
  const db = await getDb();
  const rows = await db.select().from(orders).where(eq(orders.groupId, groupId));
  if (!rows.length) return [];
  const orderIds = rows.map((row) => row.id);
  const [itemRows, shopRows] = await Promise.all([
    db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
    db.select().from(shops).where(inArray(shops.id, rows.map((row) => row.shopId))),
  ]);
  const shopById = new Map(shopRows.map((shop) => [shop.id, shop]));
  void viewerId;
  return rows.map((order) =>
    serializeOrder(order, {
      items: itemRows.filter((item) => item.orderId === order.id),
      shop: shopById.get(order.shopId) ?? null,
    }),
  );
}

/* list & detail ------------------------------------------------------------ */

ordersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const limit = Math.min(Number(req.query.limit ?? 30) || 30, 100);
    const status = typeof req.query.status === 'string' && req.query.status !== 'ALL' ? req.query.status : null;

    const rows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.customerId, user.id), status ? eq(orders.status, status as never) : undefined))
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    if (!rows.length) return res.json(ok({ orders: [], active: 0 }));

    const runnerIds = [...new Set(rows.map((row) => row.runnerId).filter((id): id is string => Boolean(id)))];

    const [items, shopRows, runnerRows, reviewRows] = await Promise.all([
      db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((row) => row.id))),
      db.select().from(shops).where(inArray(shops.id, rows.map((row) => row.shopId))),
      runnerIds.length
        ? db
            .select({ user: users, profile: runnerProfiles })
            .from(users)
            .leftJoin(runnerProfiles, eq(runnerProfiles.userId, users.id))
            .where(inArray(users.id, runnerIds))
        : Promise.resolve([] as { user: typeof users.$inferSelect; profile: typeof runnerProfiles.$inferSelect | null }[]),
      db.select().from(reviews).where(inArray(reviews.orderId, rows.map((row) => row.id))),
    ]);

    const shopById = new Map(shopRows.map((shop) => [shop.id, shop]));
    const runnerById = new Map(runnerRows.map((row) => [row.user.id, row]));
    const reviewed = new Set(reviewRows.map((row) => row.orderId));

    const list = rows.map((order) =>
      serializeOrder(order, {
        items: items.filter((item) => item.orderId === order.id),
        shop: shopById.get(order.shopId) ?? null,
        runner: order.runnerId
          ? (() => {
              const found = runnerById.get(order.runnerId);
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
        hasReview: reviewed.has(order.id),
      }),
    );

    res.json(
      ok({
        orders: list,
        active: list.filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status)).length,
      }),
    );
  }),
);

ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, String(req.params.id))).limit(1);
    if (!order) throw notFound('Order not found');

    const shop = (await db.select().from(shops).where(eq(shops.id, order.shopId)).limit(1))[0] ?? null;
    const isOwningMerchant = shop?.ownerId === user.id;
    const isAssignedRunner = order.runnerId === user.id;
    if (order.customerId !== user.id && !isOwningMerchant && !isAssignedRunner && user.role !== 'ADMIN') {
      throw forbidden('This order belongs to someone else');
    }

    const [items, events, chat, reviewRow, runnerRow, siblings] = await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
      db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(asc(orderEvents.createdAt)),
      db.select().from(messages).where(eq(messages.orderId, order.id)).orderBy(asc(messages.createdAt)),
      db.select().from(reviews).where(eq(reviews.orderId, order.id)).limit(1),
      order.runnerId
        ? db
            .select({ user: users, profile: runnerProfiles })
            .from(users)
            .leftJoin(runnerProfiles, eq(runnerProfiles.userId, users.id))
            .where(eq(users.id, order.runnerId))
            .limit(1)
        : Promise.resolve([]),
      db.select().from(orders).where(eq(orders.groupId, order.groupId)),
    ]);

    const siblingShops = siblings.length
      ? await db.select().from(shops).where(inArray(shops.id, siblings.map((row) => row.shopId)))
      : [];
    const siblingShopById = new Map(siblingShops.map((row) => [row.id, row]));

    const runner = runnerRow[0];
    res.json(
      ok({
        order: serializeOrder(order, {
          items,
          shop,
          runner: runner
            ? {
                id: runner.user.id,
                name: runner.user.name,
                phone: runner.user.phone,
                lat: runner.profile?.lat ?? null,
                lng: runner.profile?.lng ?? null,
              }
            : null,
          customer: (await db
            .select({ id: users.id, name: users.name, phone: users.phone })
            .from(users)
            .where(eq(users.id, order.customerId))
            .limit(1))[0] ?? null,
          hasReview: reviewRow.length > 0,
        }),
        group: siblings.map((row) =>
          serializeOrder(row, { shop: siblingShopById.get(row.shopId) ?? null }),
        ),
        events: events.map((event) => ({
          id: event.id,
          status: event.status,
          note: event.note,
          actorRole: event.actorRole,
          createdAt: event.createdAt,
        })),
        messages: chat.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          senderRole: message.senderRole,
          body: message.body,
          createdAt: message.createdAt,
        })),
        canCancel: canCancel(order, user.id),
        review: reviewRow[0]
          ? {
              shopRating: reviewRow[0].shopRating,
              runnerRating: reviewRow[0].runnerRating,
              comment: reviewRow[0].comment,
            }
          : null,
      }),
    );
  }),
);

function canCancel(order: typeof orders.$inferSelect, userId: string): boolean {
  if (order.customerId !== userId) return false;
  if (order.status === 'PENDING') return true;
  if (order.status !== 'ACCEPTED') return false;
  if (!order.acceptedAt) return true;
  return Date.now() - new Date(order.acceptedAt).getTime() < 5 * 60_000;
}

ordersRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, String(req.params.id))).limit(1);
    if (!order) throw notFound('Order not found');
    if (order.customerId !== user.id) throw forbidden('You can only cancel your own orders');
    if (['ON_THE_WAY', 'DELIVERED', 'CANCELLED'].includes(order.status)) {
      throw conflict('This order is already on the way and can no longer be cancelled');
    }

    const reason = String((req.body as { reason?: string })?.reason ?? 'Cancelled by the customer').slice(0, 200);
    const at = new Date().toISOString();

    await db
      .update(orders)
      .set({
        status: 'CANCELLED',
        cancelledAt: at,
        cancelledBy: user.id,
        cancelReason: reason,
        statusHistory: [...(order.statusHistory ?? []), { status: 'CANCELLED', at, note: reason }],
        updatedAt: at,
      })
      .where(eq(orders.id, order.id));

    await db.insert(orderEvents).values({
      id: newId(),
      orderId: order.id,
      status: 'CANCELLED',
      note: reason,
      actorId: user.id,
      actorRole: 'CUSTOMER',
      createdAt: at,
    });

    // put the stock back
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      if (!item.productId) continue;
      await db
        .update(products)
        .set({ stock: sql`${products.stock} + ${item.quantity}` })
        .where(eq(products.id, item.productId));
    }

    await refundOrder(order.id, reason, user.id);

    const shop = (await db.select().from(shops).where(eq(shops.id, order.shopId)).limit(1))[0];
    if (shop) {
      await notify({
        userId: shop.ownerId,
        title: `Order ${order.orderNumber} cancelled`,
        body: reason,
        type: 'order',
        data: { orderId: order.id },
      });
    }
    await emit([userRoom(user.id), orderRoom(order.id), ...(shop ? [shopRoom(shop.id)] : [])], 'order:updated', {
      orderId: order.id,
      status: 'CANCELLED',
    });

    res.json(ok({ cancelled: true }));
  }),
);

ordersRouter.post(
  '/:id/review',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const input = parseBody(reviewSchema, req.body);
    const db = await getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, String(req.params.id))).limit(1);
    if (!order) throw notFound('Order not found');
    if (order.customerId !== user.id) throw forbidden('You can only review your own orders');
    if (order.status !== 'DELIVERED') throw badRequest('You can review an order once it is delivered');

    const existing = await db.select().from(reviews).where(eq(reviews.orderId, order.id)).limit(1);
    if (existing.length) throw conflict('You already reviewed this order');

    await db.insert(reviews).values({
      id: newId(),
      orderId: order.id,
      shopId: order.shopId,
      runnerId: order.runnerId,
      customerId: user.id,
      shopRating: input.shopRating,
      runnerRating: input.runnerRating ?? null,
      comment: input.comment ?? null,
      createdAt: new Date().toISOString(),
    });

    // keep the running averages on the shop and the rider in step
    const merge = (avg: number, count: number, rating: number) =>
      Math.round(((avg * count + rating) / (count + 1)) * 10) / 10;

    const [shopRow] = await db.select().from(shops).where(eq(shops.id, order.shopId)).limit(1);
    if (shopRow) {
      await db
        .update(shops)
        .set({
          ratingAvg: merge(shopRow.ratingAvg, shopRow.ratingCount, input.shopRating),
          ratingCount: shopRow.ratingCount + 1,
        })
        .where(eq(shops.id, shopRow.id));
    }

    if (order.runnerId && input.runnerRating) {
      const [profile] = await db
        .select()
        .from(runnerProfiles)
        .where(eq(runnerProfiles.userId, order.runnerId))
        .limit(1);
      if (profile) {
        await db
          .update(runnerProfiles)
          .set({
            ratingAvg: merge(profile.ratingAvg, profile.ratingCount, input.runnerRating),
            ratingCount: profile.ratingCount + 1,
          })
          .where(eq(runnerProfiles.userId, order.runnerId));
      }
    }

    const shop = (await db.select().from(shops).where(eq(shops.id, order.shopId)).limit(1))[0];
    if (shop) {
      await notify({
        userId: shop.ownerId,
        title: `New ${input.shopRating}-star review`,
        body: input.comment || 'A customer rated their latest order.',
        type: 'info',
        data: { orderId: order.id },
      });
    }

    res.status(201).json(ok({ submitted: true }));
  }),
);

ordersRouter.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, String(req.params.id))).limit(1);
    if (!order) throw notFound('Order not found');
    const shop = (await db.select().from(shops).where(eq(shops.id, order.shopId)).limit(1))[0];
    if (
      order.customerId !== user.id &&
      order.runnerId !== user.id &&
      shop?.ownerId !== user.id &&
      user.role !== 'ADMIN'
    ) {
      throw forbidden('You are not part of this conversation');
    }
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.orderId, order.id))
      .orderBy(asc(messages.createdAt));
    res.json(
      ok({
        messages: rows.map((row) => ({
          id: row.id,
          senderId: row.senderId,
          senderRole: row.senderRole,
          body: row.body,
          createdAt: row.createdAt,
        })),
      }),
    );
  }),
);

ordersRouter.post(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const input = parseBody(messageSchema, req.body);
    const db = await getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, String(req.params.id))).limit(1);
    if (!order) throw notFound('Order not found');
    const shop = (await db.select().from(shops).where(eq(shops.id, order.shopId)).limit(1))[0];

    const isCustomer = order.customerId === user.id;
    const isRunner = order.runnerId === user.id;
    const isMerchant = shop?.ownerId === user.id;
    if (!isCustomer && !isRunner && !isMerchant && user.role !== 'ADMIN') {
      throw forbidden('You are not part of this conversation');
    }

    const row = {
      id: newId(),
      orderId: order.id,
      senderId: user.id,
      senderRole: user.role,
      body: input.body,
      createdAt: new Date().toISOString(),
    };
    await db.insert(messages).values(row);

    const recipients = new Set<string>([order.customerId, order.runnerId, shop?.ownerId].filter(Boolean) as string[]);
    recipients.delete(user.id);
    for (const recipient of recipients) {
      await notify({
        userId: recipient,
        title: `Message from ${user.name}`,
        body: input.body.slice(0, 120),
        type: 'chat',
        data: { orderId: order.id },
        silent: true,
      });
    }
    await emit(orderRoom(order.id), 'chat:message', {
      orderId: order.id,
      message: { id: row.id, senderId: user.id, senderRole: user.role, body: input.body, createdAt: row.createdAt },
    });

    res.status(201).json(ok({ message: row }));
  }),
);

ordersRouter.post(
  '/:id/reorder',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, String(req.params.id))).limit(1);
    if (!order) throw notFound('Order not found');
    if (order.customerId !== user.id) throw forbidden('You can only reorder your own orders');

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const productIds = items.map((item) => item.productId).filter(Boolean) as string[];
    const live = productIds.length
      ? await db
          .select()
          .from(products)
          .where(and(inArray(products.id, productIds), eq(products.isAvailable, true)))
      : [];
    const liveById = new Map(live.map((product) => [product.id, product]));

    res.json(
      ok({
        shopId: order.shopId,
        lines: items
          .map((item) => {
            const product = item.productId ? liveById.get(item.productId) : null;
            if (!product) return null;
            return {
              productId: product.id,
              name: product.name,
              price: product.price,
              unit: product.unit,
              emoji: product.emoji,
              quantity: Math.min(item.quantity, product.stock),
              available: product.stock >= item.quantity,
            };
          })
          .filter(Boolean),
      }),
    );
  }),
);
