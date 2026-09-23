import { z } from 'zod';

/** Version-proof email validation (no reliance on deprecated zod string methods). */
export const emailSchema = z
  .string()
  .trim()
  .min(5)
  .max(160)
  .transform((value) => value.toLowerCase())
  .refine((value) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(value), 'Enter a valid email address');

export const passwordSchema = z.string().min(8, 'Use at least 8 characters').max(128);

export const phoneSchema = z
  .string()
  .trim()
  .min(9, 'Enter a valid phone number')
  .max(20)
  .regex(/^[+0-9()\-\s]+$/, 'Digits, spaces and + only');

export const latSchema = z.number().min(-90).max(90);
export const lngSchema = z.number().min(-180).max(180);

export const coordinatesSchema = z.object({ lat: latSchema, lng: lngSchema });

export const addressInputSchema = z.object({
  label: z.string().trim().min(1).max(40).default('Home'),
  line1: z.string().trim().min(5).max(160),
  area: z.string().trim().max(80).nullish(),
  city: z.string().trim().min(2).max(80).default('Abbottabad'),
  lat: latSchema,
  lng: lngSchema,
  instructions: z.string().trim().max(300).nullish(),
  phone: z.string().trim().max(20).nullish(),
  isDefault: z.boolean().optional(),
});

export const hoursSchema = z.record(
  z.string(),
  z.object({
    open: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
    close: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
    closed: z.boolean().optional(),
  }),
);

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
  note: z.string().trim().max(200).nullish(),
});

export const checkoutGroupSchema = z.object({
  shopId: z.string().min(1),
  items: z.array(cartItemSchema).min(1, 'Add at least one item'),
  note: z.string().trim().max(300).nullish(),
  promoCode: z.string().trim().max(30).nullish(),
  tip: z.number().min(0).max(2000).default(0),
});

export const checkoutSchema = z.object({
  groups: z.array(checkoutGroupSchema).min(1),
  addressId: z.string().min(1).optional(),
  address: addressInputSchema.optional(),
  paymentMethod: z.enum(['COD', 'JAZZCASH', 'EASYPAISA', 'CARD', 'WALLET']).default('COD'),
  usePoints: z.number().int().min(0).max(100_000).default(0),
  scheduledFor: z.string().min(4).nullish(),
  notes: z.string().trim().max(500).nullish(),
  // optional client-side cart "signature" so a stale cart cannot be submitted twice
  idempotencyKey: z.string().max(80).nullish(),
});

export const orderStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'ON_THE_WAY',
  'DELIVERED',
  'CANCELLED',
]);

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullish(),
  category: z.string().trim().min(1).max(60).default('General'),
  unit: z.string().trim().min(1).max(24).default('piece'),
  price: z.number().min(1).max(1_000_000),
  compareAtPrice: z.number().min(1).max(1_000_000).nullish(),
  imageUrl: z.string().trim().max(400).nullish(),
  emoji: z.string().trim().max(8).nullish(),
  stock: z.number().int().min(0).max(100_000).default(0),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const zoneInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  radiusKm: z.number().min(0.5).max(30),
  fee: z.number().min(0).max(2000),
  freeAbove: z.number().min(0).max(100_000).nullish(),
  etaMinutes: z.number().int().min(5).max(180).default(30),
  sortOrder: z.number().int().min(0).max(20).default(0),
});

export const shopInputSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  category: z.string().trim().min(2).max(40).optional(),
  description: z.string().trim().max(600).nullish(),
  phone: phoneSchema.nullish(),
  addressLine: z.string().trim().min(5).max(200).optional(),
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
  hours: hoursSchema.optional(),
  prepTimeMin: z.number().int().min(5).max(180).optional(),
  minOrder: z.number().min(0).max(50_000).optional(),
  isOpen: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  deliveryMode: z.enum(['PLATFORM_RIDER', 'SHOP_DELIVERY', 'PICKUP']).optional(),
  tags: z.array(z.string().trim().max(30)).max(8).optional(),
  logoUrl: z.string().trim().max(400).nullish(),
  coverUrl: z.string().trim().max(400).nullish(),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: phoneSchema.nullish(),
  password: passwordSchema,
  role: z.enum(['CUSTOMER', 'MERCHANT', 'RIDER']).default('CUSTOMER'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});

export const reviewSchema = z.object({
  shopRating: z.number().int().min(1).max(5),
  runnerRating: z.number().int().min(1).max(5).nullish(),
  comment: z.string().trim().max(500).nullish(),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(600),
});

export const campaignSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(600),
  channel: z.enum(['PUSH', 'IN_APP', 'EMAIL', 'SMS']).default('IN_APP'),
  audience: z.enum(['ALL', 'CUSTOMERS', 'MERCHANTS', 'RIDERS', 'LAPSED']).default('CUSTOMERS'),
  scheduledFor: z.string().nullish(),
});

export const promoSchema = z.object({
  code: z.string().trim().min(3).max(24).transform((value) => value.toUpperCase()),
  title: z.string().trim().max(120).nullish(),
  type: z.enum(['PERCENT', 'FIXED', 'FREE_DELIVERY']),
  value: z.number().min(0).max(100_000).default(0),
  minOrder: z.number().min(0).max(100_000).default(0),
  maxDiscount: z.number().min(0).max(100_000).nullish(),
  usageLimit: z.number().int().min(1).max(1_000_000).nullish(),
  expiresAt: z.string().nullish(),
  isActive: z.boolean().default(true),
});

export const settingsPatchSchema = z.object({
  cityName: z.string().trim().min(2).max(60).optional(),
  cityLat: latSchema.optional(),
  cityLng: lngSchema.optional(),
  serviceFeePct: z.number().min(0).max(20).optional(),
  commissionPct: z.number().min(0).max(40).optional(),
  loyaltyPointsPer100: z.number().min(0).max(50).optional(),
  radiusCapKm: z.number().min(1).max(50).optional(),
  cancelWindowMinutes: z.number().int().min(0).max(120).optional(),
  supportPhone: z.string().trim().max(24).optional(),
  announcement: z.string().trim().max(240).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutGroup = z.infer<typeof checkoutGroupSchema>;

/** Shop creation (the merchant setup wizard) — name/location are required here. */
export const createShopSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(40).default('grocery'),
  description: z.string().trim().max(600).nullish(),
  phone: phoneSchema.nullish(),
  addressLine: z.string().trim().min(5).max(200),
  lat: latSchema,
  lng: lngSchema,
  hours: hoursSchema.optional(),
  prepTimeMin: z.number().int().min(5).max(180).default(15),
  minOrder: z.number().min(0).max(50_000).default(0),
  deliveryMode: z.enum(['PLATFORM_RIDER', 'SHOP_DELIVERY', 'PICKUP']).default('PLATFORM_RIDER'),
  tags: z.array(z.string().trim().max(30)).max(8).default([]),
});

export const stockDeltaSchema = z.object({ delta: z.number().int().min(-9999).max(9999) });

export const statusUpdateSchema = z.object({
  status: z.enum(['ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED']),
  note: z.string().trim().max(200).nullish(),
  reason: z.string().trim().max(200).nullish(),
});

export const assignRunnerSchema = z.object({
  runnerId: z.union([z.string().min(1), z.literal('auto')]),
});

export const addRunnerSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(2).max(80).optional(),
});

export const promoPreviewSchema = z.object({
  code: z.string().min(2).max(30),
  subtotal: z.number().min(0),
  deliveryFee: z.number().min(0).default(0),
});
