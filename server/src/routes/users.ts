import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/client.js';
import { addresses, favorites, notifications, orders, pushSubscriptions, shops, users } from '../db/schema.js';
import { authUser, requireAuth } from '../lib/auth.js';
import { asyncHandler, notFound, ok, parseBody } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { notify, vapidPublicKey } from '../lib/notify.js';
import { addressInputSchema, emailSchema, phoneSchema, payoutRequestSchema, ticketReplySchema, ticketSchema } from '../lib/schemas.js';
import { openTicket, replyToTicket, ticketsFor } from '../lib/support.js';
import { requestPayout, serializePayout, walletFor } from '../lib/wallet.js';
import { ensureReferralCode } from '../lib/referral.js';
import { serializeUser } from '../lib/serialize.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const db = await getDb();
    const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!row) throw notFound('Account not found');
    // every account owns a share code, generated the first time it is needed
    const referralCode = row.referralCode ?? (await ensureReferralCode(user.id));
    const profileRow = { ...row, referralCode };

    const [addressRows, favoriteRows, orderStats] = await Promise.all([
      db.select().from(addresses).where(eq(addresses.userId, user.id)).orderBy(desc(addresses.isDefault)),
      db
        .select({ favorite: favorites, shop: shops })
        .from(favorites)
        .innerJoin(shops, eq(shops.id, favorites.shopId))
        .where(eq(favorites.userId, user.id)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          delivered: sql<number>`count(*) filter (where status = 'DELIVERED')::int`,
          spent: sql<number>`coalesce(sum(total) filter (where status = 'DELIVERED'), 0)::float`,
        })
        .from(orders)
        .where(eq(orders.customerId, user.id)),
    ]);

    res.json(
      ok({
        user: serializeUser(profileRow),
        addresses: addressRows.map(serializeAddress),
        favorites: favoriteRows.map((row) => ({
          id: row.favorite.id,
          shopId: row.shop.id,
          name: row.shop.name,
          slug: row.shop.slug,
          category: row.shop.category,
          addressLine: row.shop.addressLine,
          ratingAvg: row.shop.ratingAvg,
          isOpen: row.shop.isOpen && !row.shop.isPaused,
        })),
        stats: orderStats[0] ?? { total: 0, delivered: 0, spent: 0 },
      }),
    );
  }),
);

usersRouter.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const input = parseBody(
      z.object({
        name: z.string().trim().min(2).max(80).optional(),
        phone: phoneSchema.nullish(),
        email: emailSchema.optional(),
        avatarUrl: z.string().trim().max(400).nullish(),
      }),
      req.body,
    );
    const db = await getDb();
    await db
      .update(users)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
        ...(input.email ? { email: input.email } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl ?? null } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id));
    const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    res.json(ok({ user: serializeUser(row!) }));
  }),
);

/* addresses ---------------------------------------------------------------- */

function serializeAddress(row: typeof addresses.$inferSelect) {
  return {
    id: row.id,
    label: row.label,
    line1: row.line1,
    area: row.area,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    landmark: row.landmark,
    instructions: row.instructions,
    isDefault: row.isDefault,
  };
}

usersRouter.get(
  '/me/addresses',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, authUser(req).id))
      .orderBy(desc(addresses.isDefault));
    res.json(ok({ addresses: rows.map(serializeAddress) }));
  }),
);

usersRouter.post(
  '/me/addresses',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const input = parseBody(addressInputSchema, req.body);
    const db = await getDb();
    const id = newId();
    if (input.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
    }
    await db.insert(addresses).values({
      id,
      userId: user.id,
      label: input.label,
      line1: input.line1,
      area: input.area ?? null,
      city: input.city,
      lat: input.lat,
      lng: input.lng,
      landmark: input.landmark ?? null,
      instructions: input.instructions ?? null,
      isDefault: input.isDefault ?? false,
      createdAt: new Date().toISOString(),
    });
    const [row] = await db.select().from(addresses).where(eq(addresses.id, id)).limit(1);
    res.status(201).json(ok({ address: serializeAddress(row!) }));
  }),
);

usersRouter.patch(
  '/me/addresses/:id',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const input = parseBody(addressInputSchema.partial(), req.body);
    const db = await getDb();
    if (input.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
    }
    await db
      .update(addresses)
      .set({
        ...(input.label ? { label: input.label } : {}),
        ...(input.line1 ? { line1: input.line1 } : {}),
        ...(input.area !== undefined ? { area: input.area ?? null } : {}),
        ...(input.city ? { city: input.city } : {}),
        ...(input.lat !== undefined ? { lat: input.lat } : {}),
        ...(input.lng !== undefined ? { lng: input.lng } : {}),
        ...(input.landmark !== undefined ? { landmark: input.landmark ?? null } : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions ?? null } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      })
      .where(and(eq(addresses.id, String(req.params.id)), eq(addresses.userId, user.id)));
    const [row] = await db.select().from(addresses).where(eq(addresses.id, String(req.params.id))).limit(1);
    if (!row) throw notFound('Address not found');
    res.json(ok({ address: serializeAddress(row) }));
  }),
);

usersRouter.delete(
  '/me/addresses/:id',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    await db
      .delete(addresses)
      .where(and(eq(addresses.id, String(req.params.id)), eq(addresses.userId, authUser(req).id)));
    res.json(ok({ deleted: true }));
  }),
);

/* favourites --------------------------------------------------------------- */

usersRouter.post(
  '/me/favorites/:shopId',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const userId = authUser(req).id;
    const existing = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.shopId, String(req.params.shopId))))
      .limit(1);
    if (existing.length) {
      await db.delete(favorites).where(eq(favorites.id, existing[0]!.id));
      return res.json(ok({ favorite: false }));
    }
    await db.insert(favorites).values({
      id: newId(),
      userId,
      shopId: String(req.params.shopId),
      createdAt: new Date().toISOString(),
    });
    res.json(ok({ favorite: true }));
  }),
);

/* notifications ------------------------------------------------------------ */

usersRouter.get(
  '/me/notifications',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, authUser(req).id))
      .orderBy(desc(notifications.createdAt))
      .limit(60);
    res.json(
      ok({
        notifications: rows.map((row) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          type: row.type,
          data: row.data,
          isRead: row.isRead,
          createdAt: row.createdAt,
        })),
        unread: rows.filter((row) => !row.isRead).length,
      }),
    );
  }),
);

usersRouter.post(
  '/me/notifications/read',
  asyncHandler(async (req, res) => {
    const { ids } = parseBody(z.object({ ids: z.array(z.string()).max(200).optional() }), req.body ?? {});
    const db = await getDb();
    const userId = authUser(req).id;
    if (ids?.length) {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, userId), sql`${notifications.id} = any(${ids})`));
    } else {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
    }
    res.json(ok({ updated: true }));
  }),
);

/* web push ----------------------------------------------------------------- */

usersRouter.get(
  '/me/push',
  asyncHandler(async (_req, res) => {
    res.json(ok({ publicKey: vapidPublicKey() }));
  }),
);

usersRouter.post(
  '/me/push',
  asyncHandler(async (req, res) => {
    const input = parseBody(
      z.object({
        endpoint: z.string().url().max(500),
        keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(5).max(100) }),
      }),
      req.body,
    );
    const db = await getDb();
    await db
      .insert(pushSubscriptions)
      .values({
        id: newId(),
        userId: authUser(req).id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: authUser(req).id },
      });
    res.json(ok({ subscribed: true }));
  }),
);

usersRouter.delete(
  '/me/push',
  asyncHandler(async (req, res) => {
    const { endpoint } = parseBody(z.object({ endpoint: z.string().max(500) }), req.body);
    const db = await getDb();
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, authUser(req).id), eq(pushSubscriptions.endpoint, endpoint)));
    res.json(ok({ subscribed: false }));
  }),
);

/* wallet ------------------------------------------------------------------- */

usersRouter.get(
  '/me/wallet',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const userId = authUser(req).id;
    const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const history = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        total: orders.total,
        pointsEarned: orders.pointsEarned,
        pointsRedeemed: orders.pointsRedeemed,
        deliveredAt: orders.deliveredAt,
        status: orders.status,
      })
      .from(orders)
      .where(and(eq(orders.customerId, userId), sql`${orders.pointsEarned} > 0 or ${orders.pointsRedeemed} > 0`))
      .orderBy(desc(orders.createdAt))
      .limit(30);

    res.json(
      ok({
        points: userRow?.walletPoints ?? 0,
        /** 1 point = 1 PKR off a future order */
        valuePkr: userRow?.walletPoints ?? 0,
        history,
      }),
    );
  }),
);

usersRouter.get(
  '/me/promos',
  asyncHandler(async (_req, res) => {
    const { promos } = await import('../db/schema.js');
    const db = await getDb();
    const rows = await db.select().from(promos).where(eq(promos.isActive, true)).limit(20);
    res.json(
      ok({
        promos: rows.map((row) => ({
          code: row.code,
          title: row.title,
          type: row.type,
          value: row.value,
          minOrder: row.minOrder,
          maxDiscount: row.maxDiscount,
          shopId: row.shopId,
        })),
      }),
    );
  }),
);

/* earnings wallet ---------------------------------------------------------- */

usersRouter.get(
  '/me/payouts',
  asyncHandler(async (req, res) => {
    const { account, wallet } = await walletFor(authUser(req).id);
    res.json(ok({ role: account.role, shopId: account.shopId, wallet }));
  }),
);

usersRouter.post(
  '/me/payouts',
  asyncHandler(async (req, res) => {
    const input = parseBody(payoutRequestSchema, req.body);
    const { account } = await walletFor(authUser(req).id);
    const row = await requestPayout(authUser(req).id, input);
    // Re-read after the insert: the balance the client shows must already
    // account for the request it just created.
    const { wallet } = await walletFor(authUser(req).id);
    await notify({
      userId: authUser(req).id,
      title: 'Withdrawal requested',
      body: `We are reviewing your Rs ${Math.round(input.amount)} withdrawal.`,
      type: 'payout',
      data: { payoutId: row.id },
    });
    res.status(201).json(ok({ payout: serializePayout(row), role: account.role, available: wallet.available }));
  }),
);

/* refer & earn ------------------------------------------------------------- */

usersRouter.get(
  '/me/referral',
  asyncHandler(async (req, res) => {
    const { referralSummary } = await import('../lib/referral.js');
    res.json(ok(await referralSummary(authUser(req).id)));
  }),
);

/* support tickets ---------------------------------------------------------- */

usersRouter.get(
  '/me/tickets',
  asyncHandler(async (req, res) => {
    res.json(ok(await ticketsFor(authUser(req).id)));
  }),
);

usersRouter.post(
  '/me/tickets',
  asyncHandler(async (req, res) => {
    const input = parseBody(ticketSchema, req.body);
    const ticket = await openTicket(authUser(req), input);
    res.status(201).json(ok({ ticket }));
  }),
);

usersRouter.post(
  '/me/tickets/:id/reply',
  asyncHandler(async (req, res) => {
    const input = parseBody(ticketReplySchema, req.body);
    const ticket = await replyToTicket(authUser(req), String(req.params.id), input.body);
    res.status(201).json(ok({ ticket }));
  }),
);
