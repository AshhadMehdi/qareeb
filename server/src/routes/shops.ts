import { Router } from 'express';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { deliveryZones, favorites, orderItems, orders, products, reviews, shops, users } from '../db/schema.js';
import { optionalAuth } from '../lib/auth.js';
import { asyncHandler, notFound, ok } from '../lib/errors.js';
import { isOpenNow, roundKm } from '../lib/geo.js';
import { quoteForShop, serializeProduct, serializeShop } from '../lib/serialize.js';

export const shopsRouter = Router();

const CATEGORY_LABELS: Record<string, string> = {
  biryani: 'Biryani & Pulao',
  karahi: 'Karahi & Handi',
  bbq: 'BBQ & Tikka',
  chapli: 'Chapli & Kebab',
  pizza: 'Pizza',
  burgers: 'Burgers',
  cafe: 'Cafe & Chai',
  grocery: 'Karyana & Grocery',
  vegetables: 'Sabzi & Fruit',
  fruit: 'Fruit',
  meat: 'Meat & Poultry',
  dairy: 'Dairy',
  bakery: 'Bakery & Sweets',
  pharmacy: 'Pharmacy',
  drinks: 'Cold Drinks',
  household: 'Household',
  electronics: 'Mobile & Electronics',
};

function parsePoint(query: Record<string, unknown>) {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

shopsRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const rows = await db
      .select({ category: shops.category, count: sql<number>`count(*)::int` })
      .from(shops)
      .where(inArray(shops.status, ['APPROVED']))
      .groupBy(shops.category);
    const data = rows
      .map((row) => ({
        key: row.category,
        label: CATEGORY_LABELS[row.category] ?? row.category,
        count: row.count,
      }))
      .sort((a, b) => b.count - a.count);
    res.json(ok({ categories: data }));
  }),
);

/**
 * Home rail: what people are actually ordering nearby. Items are ranked by real
 * order volume, then taken round-robin across shops so one busy karyana cannot
 * fill the whole rail.
 */
shopsRouter.get(
  '/popular',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const point = parsePoint(req.query as Record<string, unknown>);
    const limit = Math.min(Number(req.query.limit ?? 8) || 8, 24);

    const ranked = await db
      .select({
        productId: orderItems.productId,
        shopId: products.shopId,
        orders: sql<number>`count(*)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(sql`${orders.createdAt} > now() - interval '21 days'`)
      .groupBy(orderItems.productId, products.shopId)
      .orderBy(desc(sql`count(*)`))
      .limit(120);

    // Round-robin: one item per shop, then a second pass, and so on.
    const perShop = new Map<string, string[]>();
    for (const row of ranked) {
      if (!row.productId || !row.shopId) continue;
      const list = perShop.get(row.shopId) ?? [];
      list.push(row.productId);
      perShop.set(row.shopId, list);
    }
    const chosen: string[] = [];
    for (let round = 0; chosen.length < limit && round < 12; round += 1) {
      for (const ids of perShop.values()) {
        if (ids[round]) chosen.push(ids[round]!);
        if (chosen.length >= limit) break;
      }
    }

    const productRows = chosen.length
      ? await db
          .select({ product: products, shop: shops })
          .from(products)
          .innerJoin(shops, eq(products.shopId, shops.id))
          .where(and(eq(shops.status, 'APPROVED'), eq(products.isAvailable, true), inArray(products.id, chosen)))
      : [];

    const order = new Map(chosen.map((id, index) => [id, index]));
    productRows.sort((a, b) => (order.get(a.product.id) ?? 99) - (order.get(b.product.id) ?? 99));

    const shopIds = [...new Set(productRows.map((row) => row.shop.id))];
    const zones = shopIds.length
      ? await db.select().from(deliveryZones).where(inArray(deliveryZones.shopId, shopIds))
      : [];
    const byShop = new Map<string, typeof zones>();
    for (const zone of zones) {
      const list = byShop.get(zone.shopId) ?? [];
      list.push(zone);
      byShop.set(zone.shopId, list);
    }

    res.json(
      ok({
        products: productRows.map((row) => ({
          ...serializeProduct(row.product),
          shop: serializeShop(row.shop, { quote: quoteForShop(row.shop, byShop.get(row.shop.id) ?? [], point) }),
        })),
      }),
    );
  }),
);

/** Discovery: distance-sorted shops for the home screen and the map view. */
shopsRouter.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const point = parsePoint(req.query as Record<string, unknown>);
    const radiusKm = Math.min(Number(req.query.radius ?? 12) || 12, 40);
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'distance';
    const openNowOnly = req.query.openNow === 'true';
    const featuredOnly = req.query.featured === 'true';
    const limit = Math.min(Number(req.query.limit ?? 60) || 60, 120);

    const shopRows = await db
      .select()
      .from(shops)
      .where(
        and(
          eq(shops.status, 'APPROVED'),
          category ? eq(shops.category, category) : undefined,
          query
            ? or(
                ilike(shops.name, `%${query}%`),
                ilike(shops.description, `%${query}%`),
                sql`${shops.tags}::text ilike ${`%${query}%`}`,
                sql`exists (select 1 from ${products} p where p.shop_id = ${shops.id} and p.name ilike ${`%${query}%`})`,
              )
            : undefined,
        ),
      )
      .limit(200);

    const ids = shopRows.map((row) => row.id);
    const [zoneRows, counts, favoriteRows] = await Promise.all([
      ids.length
        ? db.select().from(deliveryZones).where(inArray(deliveryZones.shopId, ids)).orderBy(deliveryZones.sortOrder)
        : Promise.resolve([]),
      ids.length
        ? db
            .select({ shopId: products.shopId, count: sql<number>`count(*)::int` })
            .from(products)
            .where(and(inArray(products.shopId, ids), eq(products.isAvailable, true)))
            .groupBy(products.shopId)
        : Promise.resolve([]),
      req.user
        ? db.select().from(favorites).where(eq(favorites.userId, req.user.id))
        : Promise.resolve([]),
    ]);

    const zonesByShop = new Map<string, typeof zoneRows>();
    for (const zone of zoneRows) {
      const list = zonesByShop.get(zone.shopId) ?? [];
      list.push(zone);
      zonesByShop.set(zone.shopId, list);
    }
    const countByShop = new Map(counts.map((row) => [row.shopId, row.count]));
    const favoritesSet = new Set(favoriteRows.map((row) => row.shopId));

    let list = shopRows.map((shop) => {
      const zones = zonesByShop.get(shop.id) ?? [];
      const quote = quoteForShop(shop, zones, point);
      return serializeShop(shop, {
        quote,
        productCount: countByShop.get(shop.id) ?? 0,
        isFavorite: favoritesSet.has(shop.id),
      });
    });

    if (point) {
      list = list.filter((shop) => shop.distanceKm <= radiusKm || shop.distanceKm === 0);
    }
    if (openNowOnly) list = list.filter((shop) => shop.openNow);
    if (featuredOnly) list = list.filter((shop) => shop.ratingAvg >= 4.4);

    list.sort((a, b) => {
      if (sort === 'rating') return b.ratingAvg - a.ratingAvg || a.distanceKm - b.distanceKm;
      if (sort === 'fee') return a.deliveryFee - b.deliveryFee || a.distanceKm - b.distanceKm;
      if (sort === 'eta') return a.etaMinutes - b.etaMinutes || a.distanceKm - b.distanceKm;
      return a.distanceKm - b.distanceKm;
    });

    res.json(ok({ shops: list.slice(0, limit), center: point, radiusKm }));
  }),
);

/** Product search across every approved shop ("milk" finds all the shops selling milk). */
shopsRouter.get(
  '/search',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const term = String(req.query.q ?? '').trim();
    if (term.length < 2) return res.json(ok({ products: [], shops: [] }));
    const db = await getDb();
    const point = parsePoint(req.query as Record<string, unknown>);

    const [productRows, shopRows] = await Promise.all([
      db
        .select({ product: products, shop: shops })
        .from(products)
        .innerJoin(shops, eq(products.shopId, shops.id))
        .where(
          and(
            eq(shops.status, 'APPROVED'),
            eq(products.isAvailable, true),
            or(ilike(products.name, `%${term}%`), ilike(products.category, `%${term}%`)),
          ),
        )
        .limit(40),
      db
        .select()
        .from(shops)
        .where(and(eq(shops.status, 'APPROVED'), ilike(shops.name, `%${term}%`)))
        .limit(10),
    ]);

    const shopIds = [...new Set(productRows.map((row) => row.shop.id))];
    const zones = shopIds.length
      ? await db.select().from(deliveryZones).where(inArray(deliveryZones.shopId, shopIds))
      : [];
    const zonesByShop = new Map<string, typeof zones>();
    for (const zone of zones) {
      const list = zonesByShop.get(zone.shopId) ?? [];
      list.push(zone);
      zonesByShop.set(zone.shopId, list);
    }

    res.json(
      ok({
        products: productRows.map((row) => ({
          ...serializeProduct(row.product),
          shop: {
            id: row.shop.id,
            name: row.shop.name,
            slug: row.shop.slug,
            category: row.shop.category,
            openNow: row.shop.isOpen && !row.shop.isPaused && isOpenNow(row.shop.hours),
            ...quoteForShop(row.shop, zonesByShop.get(row.shop.id) ?? [], point),
          },
        })),
        shops: shopRows.map((shop) =>
          serializeShop(shop, {
            quote: quoteForShop(shop, zonesByShop.get(shop.id) ?? [], point),
          }),
        ),
      }),
    );
  }),
);

shopsRouter.get(
  '/featured',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const point = parsePoint(req.query as Record<string, unknown>);
    const limit = Math.min(Number(req.query.limit ?? 6) || 6, 16);
    const shopRows = await db
      .select()
      .from(shops)
      .where(eq(shops.status, 'APPROVED'))
      .orderBy(desc(shops.ratingAvg))
      .limit(limit);
    const ids = shopRows.map((row) => row.id);
    const zones = ids.length
      ? await db.select().from(deliveryZones).where(inArray(deliveryZones.shopId, ids))
      : [];
    const byShop = new Map<string, typeof zones>();
    for (const zone of zones) {
      const list = byShop.get(zone.shopId) ?? [];
      list.push(zone);
      byShop.set(zone.shopId, list);
    }
    res.json(
      ok({
        shops: shopRows.map((shop) =>
          serializeShop(shop, { quote: quoteForShop(shop, byShop.get(shop.id) ?? [], point) }),
        ),
      }),
    );
  }),
);

async function findShop(idOrSlug: string) {
  const db = await getDb();
  const [row] = await db
    .select({ shop: shops, ownerName: users.name })
    .from(shops)
    .leftJoin(users, eq(users.id, shops.ownerId))
    .where(or(eq(shops.id, idOrSlug), eq(shops.slug, idOrSlug)))
    .limit(1);
  return row ?? null;
}

shopsRouter.get(
  '/:idOrSlug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const found = await findShop(String(req.params.idOrSlug));
    if (!found) throw notFound('That shop could not be found');
    const shop = found.shop;
    const point = parsePoint(req.query as Record<string, unknown>);

    const [productRows, zoneRows, reviewRows] = await Promise.all([
      db
        .select()
        .from(products)
        .where(eq(products.shopId, shop.id))
        .orderBy(products.sortOrder, products.name),
      db
        .select()
        .from(deliveryZones)
        .where(eq(deliveryZones.shopId, shop.id))
        .orderBy(deliveryZones.sortOrder),
      db
        .select({ review: reviews, customerName: users.name })
        .from(reviews)
        .leftJoin(users, eq(users.id, reviews.customerId))
        .where(eq(reviews.shopId, shop.id))
        .orderBy(desc(reviews.createdAt))
        .limit(8),
    ]);

    const categories = [...new Set(productRows.map((row) => row.category))];
    const isFavorite = req.user
      ? (await db
          .select()
          .from(favorites)
          .where(and(eq(favorites.userId, req.user.id), eq(favorites.shopId, shop.id)))
          .limit(1)).length > 0
      : false;

    res.json(
      ok({
        shop: serializeShop(shop, {
          quote: quoteForShop(shop, zoneRows, point),
          productCount: productRows.length,
          isFavorite,
          ownerName: found.ownerName,
        }),
        categories,
        products: productRows.map(serializeProduct),
        zones: zoneRows.map((zone) => ({
          id: zone.id,
          name: zone.name,
          radiusKm: zone.radiusKm,
          fee: zone.fee,
          freeAbove: zone.freeAbove,
          etaMinutes: zone.etaMinutes,
        })),
        reviews: reviewRows.map((row) => ({
          id: row.review.id,
          shopRating: row.review.shopRating,
          runnerRating: row.review.runnerRating,
          comment: row.review.comment,
          customerName: row.customerName ?? 'Qareeb customer',
          createdAt: row.review.createdAt,
        })),
      }),
    );
  }),
);

/** Live delivery quote for one shop at a given address + basket size. */
shopsRouter.get(
  '/:idOrSlug/quote',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const found = await findShop(String(req.params.idOrSlug));
    if (!found) throw notFound('That shop could not be found');
    const point = parsePoint(req.query as Record<string, unknown>);
    const subtotal = Number(req.query.subtotal ?? 0) || 0;
    const zones = await db.select().from(deliveryZones).where(eq(deliveryZones.shopId, found.shop.id));
    const quote = quoteForShop(found.shop, zones, point, subtotal);
    res.json(ok({ shopId: found.shop.id, ...quote, distanceKm: roundKm(quote.distanceKm) }));
  }),
);
