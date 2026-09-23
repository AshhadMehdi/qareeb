/**
 * Qareeb database schema — PostgreSQL via Drizzle ORM.
 *
 * Money is stored in PKR as double precision, timestamps as timestamptz read
 * back as ISO strings, and every id is a nanoid text column so the seed data,
 * the API and the client all speak the same shapes.
 */
import { relations } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/* -------------------------------------------------------------------------- */
/* Domain unions                                                              */
/* -------------------------------------------------------------------------- */

export type UserRole = 'CUSTOMER' | 'MERCHANT' | 'RIDER' | 'ADMIN';
export type ShopStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'ON_THE_WAY'
  | 'DELIVERED'
  | 'CANCELLED';
export type PaymentMethod = 'COD' | 'JAZZCASH' | 'EASYPAISA' | 'CARD' | 'WALLET';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED' | 'FAILED';
export type PromoType = 'PERCENT' | 'FIXED' | 'FREE_DELIVERY';
export type DeliveryMode = 'PLATFORM_RIDER' | 'SHOP_DELIVERY' | 'PICKUP';
export type CampaignChannel = 'PUSH' | 'IN_APP' | 'EMAIL' | 'SMS';

export type OpeningHours = Record<
  string,
  { open: string; close: string; closed?: boolean }
>;

export type DeliveryAddressSnapshot = {
  label: string;
  line1: string;
  area?: string | null;
  city: string;
  lat: number;
  lng: number;
  instructions?: string | null;
  phone?: string | null;
};

export type OrderStatusEvent = { status: OrderStatus; at: string; note?: string };

/* -------------------------------------------------------------------------- */
/* People                                                                     */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    phone: text('phone'),
    name: text('name').notNull(),
    passwordHash: text('password_hash'),
    role: text('role').$type<UserRole>().notNull().default('CUSTOMER'),
    avatarUrl: text('avatar_url'),
    googleId: text('google_id'),
    isActive: boolean('is_active').notNull().default(true),
    /** loyalty points: 1 point = 1 PKR when spending */
    walletPoints: integer('wallet_points').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    index('users_role_idx').on(table.role),
    index('users_created_idx').on(table.createdAt),
  ],
);

/** Refresh tokens are stored hashed so a leaked row cannot be replayed. */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('refresh_tokens_user_idx').on(table.userId),
    uniqueIndex('refresh_tokens_hash_idx').on(table.tokenHash),
  ],
);

export const addresses = pgTable(
  'addresses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull().default('Home'),
    line1: text('line1').notNull(),
    area: text('area'),
    city: text('city').notNull().default('Abbottabad'),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    instructions: text('instructions'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('addresses_user_idx').on(table.userId)],
);

export const runnerProfiles = pgTable(
  'runner_profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    vehicleType: text('vehicle_type').$type<'bike' | 'car' | 'van' | 'bicycle'>()
      .notNull()
      .default('bike'),
    isAvailable: boolean('is_available').notNull().default(false),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    heading: doublePrecision('heading'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'string' }),
    ratingAvg: doublePrecision('rating_avg').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    totalDeliveries: integer('total_deliveries').notNull().default(0),
    /** cash collected on COD orders, swept by the merchant/admin */
    cashInHand: doublePrecision('cash_in_hand').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('runner_available_idx').on(table.isAvailable)],
);

/* -------------------------------------------------------------------------- */
/* Shops                                                                      */
/* -------------------------------------------------------------------------- */

export const shops = pgTable(
  'shops',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    category: text('category').notNull().default('grocery'),
    description: text('description'),
    phone: text('phone'),
    logoUrl: text('logo_url'),
    coverUrl: text('cover_url'),
    /** shown as-is in the shop header — no emoji mascots in the UI copy */
    addressLine: text('address_line').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    isOpen: boolean('is_open').notNull().default(true),
    /** manual "pause shop" switch the merchant can flip instantly */
    isPaused: boolean('is_paused').notNull().default(false),
    hours: jsonb('hours').$type<OpeningHours>().notNull(),
    prepTimeMin: integer('prep_time_min').notNull().default(15),
    minOrder: doublePrecision('min_order').notNull().default(0),
    ratingAvg: doublePrecision('rating_avg').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    status: text('status').$type<ShopStatus>().notNull().default('PENDING'),
    deliveryMode: text('delivery_mode').$type<DeliveryMode>().notNull().default('PLATFORM_RIDER'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    city: text('city').notNull().default('Abbottabad'),
    commissionPct: doublePrecision('commission_pct'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('shops_slug_idx').on(table.slug),
    index('shops_owner_idx').on(table.ownerId),
    index('shops_status_idx').on(table.status),
    index('shops_category_idx').on(table.category),
  ],
);

export const deliveryZones = pgTable(
  'delivery_zones',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    radiusKm: doublePrecision('radius_km').notNull(),
    fee: doublePrecision('fee').notNull(),
    freeAbove: doublePrecision('free_above'),
    etaMinutes: integer('eta_minutes').notNull().default(30),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('zones_shop_idx').on(table.shopId)],
);

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull().default('General'),
    unit: text('unit').notNull().default('piece'),
    price: doublePrecision('price').notNull(),
    compareAtPrice: doublePrecision('compare_at_price'),
    imageUrl: text('image_url'),
    emoji: text('emoji'),
    stock: integer('stock').notNull().default(0),
    isAvailable: boolean('is_available').notNull().default(true),
    isFeatured: boolean('is_featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('products_shop_idx').on(table.shopId),
    index('products_category_idx').on(table.category),
    index('products_name_idx').on(table.name),
  ],
);

export const shopRunners = pgTable(
  'shop_runners',
  {
    id: text('id').primaryKey(),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    runnerId: text('runner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('shop_runners_unique').on(table.shopId, table.runnerId)],
);

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    orderNumber: text('order_number').notNull(),
    /** ties one order per shop into a single multi-shop checkout */
    groupId: text('group_id').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => users.id),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id),
    runnerId: text('runner_id').references(() => users.id),
    status: text('status').$type<OrderStatus>().notNull().default('PENDING'),
    paymentMethod: text('payment_method').$type<PaymentMethod>().notNull().default('COD'),
    paymentStatus: text('payment_status').$type<PaymentStatus>().notNull().default('UNPAID'),
    paymentRef: text('payment_ref'),
    subtotal: doublePrecision('subtotal').notNull(),
    deliveryFee: doublePrecision('delivery_fee').notNull().default(0),
    serviceFee: doublePrecision('service_fee').notNull().default(0),
    discount: doublePrecision('discount').notNull().default(0),
    tip: doublePrecision('tip').notNull().default(0),
    total: doublePrecision('total').notNull(),
    distanceKm: doublePrecision('distance_km').notNull().default(0),
    etaMinutes: integer('eta_minutes').notNull().default(30),
    promoCode: text('promo_code'),
    notes: text('notes'),
    deliveryAddress: jsonb('delivery_address').$type<DeliveryAddressSnapshot>().notNull(),
    /** status history rendered as the tracking timeline */
    statusHistory: jsonb('status_history').$type<OrderStatusEvent[]>().notNull().default([]),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true, mode: 'string' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'string' }),
    readyAt: timestamp('ready_at', { withTimezone: true, mode: 'string' }),
    pickedUpAt: timestamp('picked_up_at', { withTimezone: true, mode: 'string' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'string' }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
    cancelledBy: text('cancelled_by'),
    cancelReason: text('cancel_reason'),
    pointsEarned: integer('points_earned').notNull().default(0),
    pointsRedeemed: integer('points_redeemed').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('orders_number_idx').on(table.orderNumber),
    index('orders_customer_idx').on(table.customerId),
    index('orders_shop_idx').on(table.shopId),
    index('orders_runner_idx').on(table.runnerId),
    index('orders_status_idx').on(table.status),
    index('orders_group_idx').on(table.groupId),
    index('orders_created_idx').on(table.createdAt),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: text('product_id'),
    name: text('name').notNull(),
    unit: text('unit').notNull().default('piece'),
    unitPrice: doublePrecision('unit_price').notNull(),
    quantity: integer('quantity').notNull(),
    total: doublePrecision('total').notNull(),
    note: text('note'),
    emoji: text('emoji'),
    imageUrl: text('image_url'),
  },
  (table) => [index('order_items_order_idx').on(table.orderId)],
);

export const orderEvents = pgTable(
  'order_events',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    note: text('note'),
    actorId: text('actor_id'),
    actorRole: text('actor_role'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('order_events_order_idx').on(table.orderId)],
);

export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: text('provider').$type<PaymentMethod>().notNull(),
    amount: doublePrecision('amount').notNull(),
    status: text('status').$type<PaymentStatus>().notNull().default('UNPAID'),
    providerRef: text('provider_ref'),
    failureReason: text('failure_reason'),
    raw: jsonb('raw').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('payment_tx_order_idx').on(table.orderId),
    index('payment_tx_status_idx').on(table.status),
  ],
);

export const reviews = pgTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    runnerId: text('runner_id').references(() => users.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shopRating: integer('shop_rating').notNull(),
    runnerRating: integer('runner_rating'),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('reviews_order_idx').on(table.orderId),
    index('reviews_shop_idx').on(table.shopId),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    senderId: text('sender_id').notNull(),
    senderRole: text('sender_role').$type<UserRole>().notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('messages_order_idx').on(table.orderId)],
);

export const favorites = pgTable(
  'favorites',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shopId: text('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('favorites_unique').on(table.userId, table.shopId)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    type: text('type').notNull().default('info'),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)],
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('push_endpoint_idx').on(table.endpoint)],
);

/** Append-only event feed powering the 5-second authorized polling loop. */
export const realtimeEvents = pgTable(
  'realtime_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    room: text('room').notNull(),
    event: text('event').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('realtime_room_id_idx').on(table.room, table.id),
    index('realtime_created_idx').on(table.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Promotions, campaigns and platform operations                              */
/* -------------------------------------------------------------------------- */

export const promos = pgTable(
  'promos',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    shopId: text('shop_id').references(() => shops.id, { onDelete: 'cascade' }),
    title: text('title'),
    type: text('type').$type<PromoType>().notNull(),
    value: doublePrecision('value').notNull().default(0),
    minOrder: doublePrecision('min_order').notNull().default(0),
    maxDiscount: doublePrecision('max_discount'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    usageLimit: integer('usage_limit'),
    usedCount: integer('used_count').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('promos_code_idx').on(table.code)],
);

export const campaigns = pgTable(
  'campaigns',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    channel: text('channel').$type<CampaignChannel>().notNull().default('IN_APP'),
    /** AUDIENCE_ALL | CUSTOMERS | MERCHANTS | RIDERS | LAPSED */
    audience: text('audience').notNull().default('CUSTOMERS'),
    status: text('status').$type<'DRAFT' | 'SCHEDULED' | 'SENT'>().notNull().default('DRAFT'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true, mode: 'string' }),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
    recipients: integer('recipients').notNull().default(0),
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('campaigns_status_idx').on(table.status)],
);

/** Platform-wide service areas, on top of each shop's own delivery rings. */
export const serviceAreas = pgTable(
  'service_areas',
  {
    id: text('id').primaryKey(),
    city: text('city').notNull().default('Abbottabad'),
    name: text('name').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    radiusKm: doublePrecision('radius_km').notNull(),
    baseFee: doublePrecision('base_fee').notNull().default(60),
    surgeMultiplier: doublePrecision('surge_multiplier').notNull().default(1),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('service_areas_city_idx').on(table.city)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id'),
    actorRole: text('actor_role').$type<UserRole>(),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    /** redacted by the writer — never store tokens or passwords here */
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('audit_logs_actor_idx').on(table.actorId),
    index('audit_logs_entity_idx').on(table.entity, table.entityId),
    index('audit_logs_created_idx').on(table.createdAt),
  ],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  updatedBy: text('updated_by'),
});

export const uploadedImages = pgTable('uploaded_images', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  mime: text('mime').notNull(),
  /** base64 payload: keeps Vercel to a single service, no object storage */
  data: text('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

/** Shared login throttling so limits hold across serverless instances. */
export const apiRateLimits = pgTable(
  'api_rate_limits',
  {
    key: text('key').primaryKey(),
    hits: integer('hits').notNull(),
    resetAt: timestamp('reset_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [index('api_rate_limits_reset_idx').on(table.resetAt)],
);

/* -------------------------------------------------------------------------- */
/* Relations (used by API joins)                                              */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many, one }) => ({
  addresses: many(addresses),
  orders: many(orders),
  runnerProfile: one(runnerProfiles, {
    fields: [users.id],
    references: [runnerProfiles.userId],
  }),
}));

export const shopsRelations = relations(shops, ({ many, one }) => ({
  owner: one(users, { fields: [shops.ownerId], references: [users.id] }),
  products: many(products),
  zones: many(deliveryZones),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  events: many(orderEvents),
  shop: one(shops, { fields: [orders.shopId], references: [shops.id] }),
  customer: one(users, { fields: [orders.customerId], references: [users.id] }),
  runner: one(users, { fields: [orders.runnerId], references: [users.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type ShopRow = typeof shops.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type DeliveryZoneRow = typeof deliveryZones.$inferSelect;
export type RunnerProfileRow = typeof runnerProfiles.$inferSelect;
export type PromoRow = typeof promos.$inferSelect;
export type CampaignRow = typeof campaigns.$inferSelect;
