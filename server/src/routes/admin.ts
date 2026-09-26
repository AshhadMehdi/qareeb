import { Router } from 'express';
import { and, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/client.js';
import {
  auditLogs,
  campaigns,
  deliveryZones,
  notifications,
  orderItems,
  orders,
  products,
  promos,
  runnerProfiles,
  serviceAreas,
  shops,
  users,
  type ShopStatus,
  type UserRole,
} from '../db/schema.js';
import { authUser, requireAuth, requireRole } from '../lib/auth.js';
import { asyncHandler, badRequest, notFound, ok, parseBody } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { notify } from '../lib/notify.js';
import { emit, userRoom } from '../lib/realtime.js';
import { campaignSchema, emailSchema, promoSchema, settingsPatchSchema, ticketReplySchema } from '../lib/schemas.js';
import { allTickets, replyToTicket, setTicketStatus } from '../lib/support.js';
import { decidePayout, payoutQueue } from '../lib/wallet.js';
import { serializePromo } from '../lib/serialize.js';
import { getSettings, updateSettings } from '../lib/settings.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

async function audit(entry: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}) {
  const db = await getDb();
  await db.insert(auditLogs).values({
    id: newId(),
    actorId: entry.actorId,
    actorRole: 'ADMIN',
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    meta: entry.meta ?? {},
    createdAt: new Date().toISOString(),
  });
}

/* dashboard ---------------------------------------------------------------- */

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const since = new Date(Date.now() - 13 * 86_400_000).toISOString();
    const settings = await getSettings();

    const [orderRows, userRows, shopRows, riders] = await Promise.all([
      db.select().from(orders).where(gte(orders.createdAt, since)),
      db.select({ role: users.role, count: sql<number>`count(*)::int` }).from(users).groupBy(users.role),
      db.select().from(shops),
      db
        .select({ user: users, profile: runnerProfiles })
        .from(users)
        .innerJoin(runnerProfiles, eq(runnerProfiles.userId, users.id))
        .where(eq(users.role, 'RIDER')),
    ]);

    const delivered = orderRows.filter((row) => row.status === 'DELIVERED');
    const gmv = delivered.reduce((sum, row) => sum + row.total, 0);
    const commission = (delivered.reduce((sum, row) => sum + row.subtotal, 0) * settings.commissionPct) / 100;
    const serviceFees = delivered.reduce((sum, row) => sum + row.serviceFee, 0);

    const daily = new Map<string, { date: string; orders: number; gmv: number }>();
    for (let index = 13; index >= 0; index -= 1) {
      const key = new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10);
      daily.set(key, { date: key, orders: 0, gmv: 0 });
    }
    for (const row of orderRows) {
      if (row.status === 'CANCELLED') continue;
      const bucket = daily.get(String(row.createdAt).slice(0, 10));
      if (!bucket) continue;
      bucket.orders += 1;
      bucket.gmv += row.total;
    }

    const onlineRiders = riders.filter((row) => {
      const seen = row.profile.lastSeenAt ? new Date(row.profile.lastSeenAt).getTime() : 0;
      return row.profile.isAvailable && Date.now() - seen < 10 * 60_000;
    });

    res.json(
      ok({
        totals: {
          gmv: Math.round(gmv),
          commission: Math.round(commission),
          serviceFees: Math.round(serviceFees),
          orders: orderRows.length,
          delivered: delivered.length,
          cancelled: orderRows.filter((row) => row.status === 'CANCELLED').length,
          averageOrderValue: delivered.length ? Math.round(gmv / delivered.length) : 0,
        },
        counts: {
          users: userRows,
          shops: shopRows.length,
          approvedShops: shopRows.filter((row) => row.status === 'APPROVED').length,
          pendingShops: shopRows.filter((row) => row.status === 'PENDING').length,
          riders: riders.length,
          ridersOnline: onlineRiders.length,
        },
        daily: [...daily.values()],
        live: {
          shops: shopRows.map((shop) => ({
            id: shop.id,
            name: shop.name,
            lat: shop.lat,
            lng: shop.lng,
            isOpen: shop.isOpen && !shop.isPaused,
            status: shop.status,
            ratingAvg: shop.ratingAvg,
          })),
          riders: riders.map((row) => ({
            id: row.user.id,
            name: row.user.name,
            lat: row.profile.lat,
            lng: row.profile.lng,
            isAvailable: row.profile.isAvailable,
            lastSeenAt: row.profile.lastSeenAt,
            activeOrders: orderRows.filter(
              (order) => order.runnerId === row.user.id && order.status === 'ON_THE_WAY',
            ).length,
          })),
        },
        settings,
      }),
    );
  }),
);

/* shops -------------------------------------------------------------------- */

adminRouter.get(
  '/shops',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const status = typeof req.query.status === 'string' && req.query.status !== 'ALL' ? req.query.status : null;
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const rows = await db
      .select({ shop: shops, ownerName: users.name, ownerEmail: users.email })
      .from(shops)
      .leftJoin(users, eq(users.id, shops.ownerId))
      .where(
        and(
          status ? eq(shops.status, status as ShopStatus) : undefined,
          query ? or(ilike(shops.name, `%${query}%`), ilike(users.email, `%${query}%`)) : undefined,
        ),
      )
      .orderBy(desc(shops.createdAt))
      .limit(200);

    const counts = await db
      .select({ status: shops.status, count: sql<number>`count(*)::int` })
      .from(shops)
      .groupBy(shops.status);
    const zonalCounts = await db
      .select({ shopId: deliveryZones.shopId, count: sql<number>`count(*)::int` })
      .from(deliveryZones)
      .groupBy(deliveryZones.shopId);
    const productCounts = await db
      .select({ shopId: products.shopId, count: sql<number>`count(*)::int` })
      .from(products)
      .groupBy(products.shopId);

    const zoneByShop = new Map(zonalCounts.map((row) => [row.shopId, row.count]));
    const productByShop = new Map(productCounts.map((row) => [row.shopId, row.count]));

    res.json(
      ok({
        shops: rows.map((row) => ({
          ...row.shop,
          ownerName: row.ownerName,
          ownerEmail: row.ownerEmail,
          zones: zoneByShop.get(row.shop.id) ?? 0,
          products: productByShop.get(row.shop.id) ?? 0,
        })),
        counts,
      }),
    );
  }),
);

adminRouter.post(
  '/shops/:id/status',
  asyncHandler(async (req, res) => {
    const { status, reason } = parseBody(
      z.object({
        status: z.enum(['PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED']),
        reason: z.string().max(200).nullish(),
      }),
      req.body,
    );
    const actor = authUser(req);
    const db = await getDb();
    const [shop] = await db.select().from(shops).where(eq(shops.id, String(req.params.id))).limit(1);
    if (!shop) throw notFound('Shop not found');

    await db
      .update(shops)
      .set({ status: status as ShopStatus, updatedAt: new Date().toISOString() })
      .where(eq(shops.id, shop.id));

    await notify({
      userId: shop.ownerId,
      title:
        status === 'APPROVED'
          ? `${shop.name} is live on Qareeb`
          : status === 'SUSPENDED'
            ? `${shop.name} has been suspended`
            : `${shop.name} status updated`,
      body: reason ?? (status === 'APPROVED' ? 'Customers nearby can order from you now.' : 'Contact support for details.'),
      type: 'system',
      data: { shopId: shop.id },
    });
    await audit({ actorId: actor.id, action: `shop.${status.toLowerCase()}`, entity: 'shop', entityId: shop.id, meta: { reason } });

    res.json(ok({ status }));
  }),
);

/* users -------------------------------------------------------------------- */

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const role = typeof req.query.role === 'string' && req.query.role !== 'ALL' ? req.query.role : null;
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const rows = await db
      .select()
      .from(users)
      .where(
        and(
          role ? eq(users.role, role as UserRole) : undefined,
          query ? or(ilike(users.name, `%${query}%`), ilike(users.email, `%${query}%`)) : undefined,
        ),
      )
      .orderBy(desc(users.createdAt))
      .limit(200);

    const spend = await db
      .select({
        customerId: orders.customerId,
        orders: sql<number>`count(*)::int`,
        spent: sql<number>`coalesce(sum(${orders.total}) filter (where status = 'DELIVERED'), 0)::float`,
      })
      .from(orders)
      .groupBy(orders.customerId);
    const spendById = new Map(spend.map((row) => [row.customerId, row]));

    res.json(
      ok({
        users: rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          role: row.role,
          isActive: row.isActive,
          walletPoints: row.walletPoints,
          createdAt: row.createdAt,
          orders: spendById.get(row.id)?.orders ?? 0,
          spent: spendById.get(row.id)?.spent ?? 0,
        })),
      }),
    );
  }),
);

adminRouter.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const input = parseBody(
      z.object({
        role: z.enum(['CUSTOMER', 'MERCHANT', 'RIDER', 'ADMIN']).optional(),
        isActive: z.boolean().optional(),
        name: z.string().trim().min(2).max(80).optional(),
        phone: z.string().trim().max(20).nullish(),
        walletPoints: z.number().int().min(0).max(1_000_000).optional(),
        email: emailSchema.optional(),
      }),
      req.body,
    );
    const actor = authUser(req);
    const db = await getDb();
    const [target] = await db.select().from(users).where(eq(users.id, String(req.params.id))).limit(1);
    if (!target) throw notFound('User not found');
    if (target.id === actor.id && input.isActive === false) throw badRequest('You cannot disable your own account');

    await db
      .update(users)
      .set({
        ...input,
        phone: input.phone === undefined ? undefined : input.phone ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, target.id));

    if (input.role === 'RIDER') {
      const existing = await db
        .select()
        .from(runnerProfiles)
        .where(eq(runnerProfiles.userId, target.id))
        .limit(1);
      if (!existing.length) {
        await db
          .insert(runnerProfiles)
          .values({ userId: target.id, vehicleType: 'bike', isAvailable: false, createdAt: new Date().toISOString() });
      }
    }

    await audit({
      actorId: actor.id,
      action: 'user.update',
      entity: 'user',
      entityId: target.id,
      meta: { fields: Object.keys(input) },
    });
    res.json(ok({ updated: true }));
  }),
);

/* orders ------------------------------------------------------------------- */

adminRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const status = typeof req.query.status === 'string' && req.query.status !== 'ALL' ? req.query.status : null;
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const rows = await db
      .select({ order: orders, shopName: shops.name, customerName: users.name })
      .from(orders)
      .leftJoin(shops, eq(shops.id, orders.shopId))
      .leftJoin(users, eq(users.id, orders.customerId))
      .where(
        and(
          status ? eq(orders.status, status as never) : undefined,
          query ? ilike(orders.orderNumber, `%${query}%`) : undefined,
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(120);

    const items = rows.length
      ? await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((row) => row.order.id)))
      : [];

    res.json(
      ok({
        orders: rows.map((row) => ({
          ...row.order,
          shopName: row.shopName,
          customerName: row.customerName,
          items: items
            .filter((item) => item.orderId === row.order.id)
            .map((item) => ({ name: item.name, quantity: item.quantity, total: item.total })),
        })),
      }),
    );
  }),
);

/* settings, promos, campaigns, service areas ------------------------------- */

adminRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    res.json(ok({ settings: await getSettings(true) }));
  }),
);

adminRouter.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const input = parseBody(settingsPatchSchema, req.body);
    const actor = authUser(req);
    const updated = await updateSettings(input, actor.id);
    await audit({ actorId: actor.id, action: 'settings.update', entity: 'settings', meta: { keys: Object.keys(input) } });
    res.json(ok({ settings: updated }));
  }),
);

adminRouter.get(
  '/promos',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const rows = await db.select().from(promos).orderBy(desc(promos.createdAt)).limit(100);
    res.json(ok({ promos: rows.map(serializePromo) }));
  }),
);

adminRouter.post(
  '/promos',
  asyncHandler(async (req, res) => {
    const input = parseBody(promoSchema, req.body);
    const actor = authUser(req);
    const db = await getDb();
    const id = newId();
    await db.insert(promos).values({
      id,
      code: input.code,
      shopId: null,
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
    await audit({ actorId: actor.id, action: 'promo.create', entity: 'promo', entityId: id, meta: { code: input.code } });
    const [row] = await db.select().from(promos).where(eq(promos.id, id)).limit(1);
    res.status(201).json(ok({ promo: serializePromo(row!) }));
  }),
);

adminRouter.patch(
  '/promos/:id',
  asyncHandler(async (req, res) => {
    const input = parseBody(
      z.object({
        title: z.string().trim().max(120).nullish(),
        type: z.enum(['PERCENT', 'FIXED', 'FREE_DELIVERY']).optional(),
        value: z.number().min(0).max(100_000).optional(),
        minOrder: z.number().min(0).max(100_000).optional(),
        maxDiscount: z.number().min(0).max(100_000).nullish(),
        usageLimit: z.number().int().min(1).max(1_000_000).nullish(),
        expiresAt: z.string().nullish(),
        isActive: z.boolean().optional(),
      }),
      req.body,
    );
    const actor = authUser(req);
    const db = await getDb();
    await db
      .update(promos)
      .set({
        ...input,
        maxDiscount: input.maxDiscount === undefined ? undefined : input.maxDiscount ?? null,
        expiresAt: input.expiresAt === undefined ? undefined : input.expiresAt ?? null,
        usageLimit: input.usageLimit === undefined ? undefined : input.usageLimit ?? null,
      })
      .where(eq(promos.id, String(req.params.id)));
    const [row] = await db.select().from(promos).where(eq(promos.id, String(req.params.id))).limit(1);
    if (!row) throw notFound('Promo not found');
    await audit({ actorId: actor.id, action: 'promo.update', entity: 'promo', entityId: row.id, meta: { ...input } });
    res.json(ok({ promo: serializePromo(row) }));
  }),
);

adminRouter.get(
  '/campaigns',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(50);
    res.json(ok({ campaigns: rows }));
  }),
);

adminRouter.post(
  '/campaigns',
  asyncHandler(async (req, res) => {
    const input = parseBody(campaignSchema, req.body);
    const actor = authUser(req);
    const db = await getDb();
    const id = newId();
    await db.insert(campaigns).values({
      id,
      title: input.title,
      body: input.body,
      channel: input.channel,
      audience: input.audience,
      status: input.scheduledFor ? 'SCHEDULED' : 'DRAFT',
      scheduledFor: input.scheduledFor ?? null,
      createdBy: actor.id,
      createdAt: new Date().toISOString(),
    });
    await audit({ actorId: actor.id, action: 'campaign.create', entity: 'campaign', entityId: id });
    const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    res.status(201).json(ok({ campaign: row }));
  }),
);

/** Sending is a fan-out to the in-app notification centre (+ web push if configured). */
adminRouter.post(
  '/campaigns/:id/send',
  asyncHandler(async (req, res) => {
    const actor = authUser(req);
    const db = await getDb();
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, String(req.params.id))).limit(1);
    if (!campaign) throw notFound('Campaign not found');
    if (campaign.status === 'SENT') throw badRequest('This campaign was already sent');

    const audienceRoles: UserRole[] | null =
      campaign.audience === 'ALL'
        ? null
        : campaign.audience === 'MERCHANTS'
          ? ['MERCHANT']
          : campaign.audience === 'RIDERS'
            ? ['RIDER']
            : ['CUSTOMER'];

    const recipients = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          audienceRoles ? inArray(users.role, audienceRoles) : undefined,
        ),
      )
      .limit(5000);

    for (const recipient of recipients) {
      await notify({
        userId: recipient.id,
        title: campaign.title,
        body: campaign.body,
        type: 'promo',
        data: { campaignId: campaign.id },
      });
    }

    await db
      .update(campaigns)
      .set({ status: 'SENT', sentAt: new Date().toISOString(), recipients: recipients.length })
      .where(eq(campaigns.id, campaign.id));
    await audit({
      actorId: actor.id,
      action: 'campaign.send',
      entity: 'campaign',
      entityId: campaign.id,
      meta: { recipients: recipients.length },
    });

    res.json(ok({ sent: recipients.length }));
  }),
);

adminRouter.post(
  '/broadcast',
  asyncHandler(async (req, res) => {
    const input = parseBody(
      z.object({
        title: z.string().trim().min(2).max(120),
        body: z.string().trim().min(2).max(400),
        audience: z.enum(['ALL', 'CUSTOMERS', 'MERCHANTS', 'RIDERS']).default('ALL'),
      }),
      req.body,
    );
    const actor = authUser(req);
    const db = await getDb();
    const roles: UserRole[] | null =
      input.audience === 'ALL'
        ? null
        : input.audience === 'MERCHANTS'
          ? ['MERCHANT']
          : input.audience === 'RIDERS'
            ? ['RIDER']
            : ['CUSTOMER'];

    const recipients = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isActive, true), roles ? inArray(users.role, roles) : undefined))
      .limit(5000);

    for (const recipient of recipients) {
      await notify({ userId: recipient.id, title: input.title, body: input.body, type: 'system' });
      await emit(userRoom(recipient.id), 'notification', { title: input.title, body: input.body });
    }
    await audit({ actorId: actor.id, action: 'broadcast', entity: 'users', meta: { count: recipients.length } });
    res.json(ok({ sent: recipients.length }));
  }),
);

adminRouter.get(
  '/service-areas',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const rows = await db.select().from(serviceAreas).orderBy(desc(serviceAreas.createdAt));
    res.json(ok({ areas: rows }));
  }),
);

adminRouter.post(
  '/service-areas',
  asyncHandler(async (req, res) => {
    const input = parseBody(
      z.object({
        name: z.string().trim().min(2).max(80),
        city: z.string().trim().min(2).max(60).default('Abbottabad'),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusKm: z.number().min(0.5).max(60),
        baseFee: z.number().min(0).max(5000).default(60),
        surgeMultiplier: z.number().min(1).max(3).default(1),
      }),
      req.body,
    );
    const actor = authUser(req);
    const db = await getDb();
    const id = newId();
    await db.insert(serviceAreas).values({
      id,
      city: input.city,
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      radiusKm: input.radiusKm,
      baseFee: input.baseFee,
      surgeMultiplier: input.surgeMultiplier,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    await audit({ actorId: actor.id, action: 'service_area.create', entity: 'service_area', entityId: id });
    res.status(201).json(ok({ area: { id } }));
  }),
);

adminRouter.patch(
  '/service-areas/:id',
  asyncHandler(async (req, res) => {
    const input = parseBody(
      z.object({
        name: z.string().trim().min(2).max(80).optional(),
        radiusKm: z.number().min(0.5).max(60).optional(),
        baseFee: z.number().min(0).max(5000).optional(),
        surgeMultiplier: z.number().min(1).max(3).optional(),
        isActive: z.boolean().optional(),
      }),
      req.body,
    );
    const db = await getDb();
    await db.update(serviceAreas).set(input).where(eq(serviceAreas.id, String(req.params.id)));
    res.json(ok({ updated: true }));
  }),
);

adminRouter.get(
  '/audit-logs',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const rows = await db
      .select({ log: auditLogs, actorName: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
    res.json(
      ok({
        logs: rows.map((row) => ({ ...row.log, actorName: row.actorName ?? 'System' })),
      }),
    );
  }),
);

adminRouter.get(
  '/notifications',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(40);
    res.json(ok({ notifications: rows }));
  }),
);

/* payouts ------------------------------------------------------------------ */

adminRouter.get(
  '/payouts',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    res.json(ok(await payoutQueue(status)));
  }),
);

adminRouter.post(
  '/payouts/:id/status',
  asyncHandler(async (req, res) => {
    const input = parseBody(
      z.object({
        status: z.enum(['APPROVED', 'PAID', 'REJECTED']),
        note: z.string().trim().max(200).nullish(),
      }),
      req.body,
    );
    const actor = authUser(req);
    const updated = await decidePayout(String(req.params.id), input.status, actor.id, input.note);
    await audit({
      actorId: actor.id,
      action: `payout.${input.status.toLowerCase()}`,
      entity: 'payout',
      entityId: updated.id,
      meta: { amount: updated.amount, userId: updated.userId },
    });
    await notify({
      userId: updated.userId,
      title:
        input.status === 'PAID'
          ? 'Payout sent'
          : input.status === 'APPROVED'
            ? 'Payout approved'
            : 'Payout request declined',
      body:
        input.status === 'REJECTED'
          ? input.note ?? 'Your withdrawal request was declined. The money stays in your wallet.'
          : `Rs ${Math.round(updated.amount)} — ${input.note ?? 'thanks for riding with Qareeb'}`,
      type: 'payout',
      data: { payoutId: updated.id, status: updated.status },
    });
    res.json(ok({ payout: updated }));
  }),
);

/* support tickets ---------------------------------------------------------- */

adminRouter.get(
  '/tickets',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    res.json(ok(await allTickets(status)));
  }),
);

adminRouter.post(
  '/tickets/:id/reply',
  asyncHandler(async (req, res) => {
    const input = parseBody(ticketReplySchema, req.body);
    const actor = authUser(req);
    const ticket = await replyToTicket({ id: actor.id, role: actor.role }, String(req.params.id), input.body);
    await audit({ actorId: actor.id, action: 'ticket.reply', entity: 'ticket', entityId: ticket.id });
    res.status(201).json(ok({ ticket }));
  }),
);

adminRouter.post(
  '/tickets/:id/status',
  asyncHandler(async (req, res) => {
    const input = parseBody(z.object({ status: z.enum(['OPEN', 'ANSWERED', 'RESOLVED']) }), req.body);
    const actor = authUser(req);
    const ticket = await setTicketStatus(String(req.params.id), input.status);
    await audit({ actorId: actor.id, action: `ticket.${input.status.toLowerCase()}`, entity: 'ticket', entityId: ticket.id });
    res.json(ok({ ticket }));
  }),
);
