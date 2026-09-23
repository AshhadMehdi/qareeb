import type {
  DeliveryZoneRow,
  OrderItemRow,
  OrderRow,
  ProductRow,
  PromoRow,
  RunnerProfileRow,
  ShopRow,
  UserRow,
} from '../db/schema.js';
import { isOpenNow, quoteZone } from './geo.js';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  walletPoints: number;
  createdAt: string;
};

export function serializeUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    avatarUrl: row.avatarUrl,
    walletPoints: row.walletPoints,
    createdAt: String(row.createdAt),
  };
}

export function serializeProduct(row: ProductRow) {
  return {
    id: row.id,
    shopId: row.shopId,
    name: row.name,
    description: row.description,
    category: row.category,
    unit: row.unit,
    price: row.price,
    compareAtPrice: row.compareAtPrice,
    imageUrl: row.imageUrl,
    emoji: row.emoji,
    stock: row.stock,
    isAvailable: row.isAvailable,
    isFeatured: row.isFeatured,
    sortOrder: row.sortOrder,
  };
}

export type ShopQuote = {
  distanceKm: number;
  deliveryFee: number;
  etaMinutes: number;
  deliverable: boolean;
  freeDelivery: boolean;
  zoneName: string | null;
};

export function quoteForShop(
  shop: ShopRow,
  zones: DeliveryZoneRow[],
  destination: { lat: number; lng: number } | null,
  subtotal = 0,
): ShopQuote {
  if (!destination) {
    return {
      distanceKm: 0,
      deliveryFee: 0,
      etaMinutes: shop.prepTimeMin + 15,
      deliverable: true,
      freeDelivery: false,
      zoneName: zones[0]?.name ?? null,
    };
  }
  const quote = quoteZone(shop, destination, zones, subtotal);
  return {
    distanceKm: quote.distanceKm,
    deliveryFee: quote.fee,
    etaMinutes: quote.etaMinutes,
    deliverable: quote.deliverable,
    freeDelivery: quote.freeDelivery,
    zoneName: quote.zone?.name ?? null,
  };
}

export function serializeShop(
  shop: ShopRow,
  options: {
    quote: ShopQuote;
    productCount?: number;
    isFavorite?: boolean;
    ownerName?: string | null;
  },
) {
  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    category: shop.category,
    description: shop.description,
    phone: shop.phone,
    logoUrl: shop.logoUrl,
    coverUrl: shop.coverUrl,
    addressLine: shop.addressLine,
    area: shop.addressLine.split(',').slice(-2, -1)[0]?.trim() ?? 'Abbottabad',
    lat: shop.lat,
    lng: shop.lng,
    city: shop.city,
    isOpen: shop.isOpen && !shop.isPaused,
    isPaused: shop.isPaused,
    openNow: shop.isOpen && !shop.isPaused && isOpenNow(shop.hours),
    hours: shop.hours,
    prepTimeMin: shop.prepTimeMin,
    minOrder: shop.minOrder,
    ratingAvg: shop.ratingAvg,
    ratingCount: shop.ratingCount,
    status: shop.status,
    tags: shop.tags,
    deliveryMode: shop.deliveryMode,
    ownerName: options.ownerName ?? null,
    productCount: options.productCount ?? 0,
    isFavorite: options.isFavorite ?? false,
    ...options.quote,
  };
}

export function serializeOrder(
  order: OrderRow,
  extras: {
    items?: OrderItemRow[];
    shop?: Pick<ShopRow, 'id' | 'name' | 'slug' | 'lat' | 'lng' | 'addressLine' | 'phone' | 'logoUrl'> | null;
    runner?: { id: string; name: string; phone: string | null; lat: number | null; lng: number | null } | null;
    customer?: { id: string; name: string; phone: string | null } | null;
    hasReview?: boolean;
  } = {},
) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    groupId: order.groupId,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paymentRef: order.paymentRef,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    serviceFee: order.serviceFee,
    discount: order.discount,
    tip: order.tip,
    total: order.total,
    distanceKm: order.distanceKm,
    etaMinutes: order.etaMinutes,
    promoCode: order.promoCode,
    notes: order.notes,
    deliveryAddress: order.deliveryAddress,
    statusHistory: order.statusHistory ?? [],
    scheduledFor: order.scheduledFor,
    acceptedAt: order.acceptedAt,
    readyAt: order.readyAt,
    pickedUpAt: order.pickedUpAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    pointsEarned: order.pointsEarned,
    pointsRedeemed: order.pointsRedeemed,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: (extras.items ?? []).map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      unit: item.unit,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      total: item.total,
      note: item.note,
      emoji: item.emoji,
      imageUrl: item.imageUrl,
    })),
    shop: extras.shop ?? null,
    runner: extras.runner ?? null,
    customer: extras.customer ?? null,
    hasReview: extras.hasReview ?? false,
  };
}

export function serializeRunner(
  user: Pick<UserRow, 'id' | 'name' | 'email' | 'phone' | 'avatarUrl'>,
  profile: RunnerProfileRow | null,
  extras: { activeOrders?: number; distanceKm?: number | null } = {},
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    vehicleType: profile?.vehicleType ?? 'bike',
    isAvailable: profile?.isAvailable ?? false,
    lat: profile?.lat ?? null,
    lng: profile?.lng ?? null,
    lastSeenAt: profile?.lastSeenAt ?? null,
    ratingAvg: profile?.ratingAvg ?? 0,
    ratingCount: profile?.ratingCount ?? 0,
    totalDeliveries: profile?.totalDeliveries ?? 0,
    cashInHand: profile?.cashInHand ?? 0,
    activeOrders: extras.activeOrders ?? 0,
    distanceKm: extras.distanceKm ?? null,
  };
}

export function serializePromo(promo: PromoRow) {
  return {
    id: promo.id,
    code: promo.code,
    title: promo.title,
    shopId: promo.shopId,
    type: promo.type,
    value: promo.value,
    minOrder: promo.minOrder,
    maxDiscount: promo.maxDiscount,
    expiresAt: promo.expiresAt,
    usageLimit: promo.usageLimit,
    usedCount: promo.usedCount,
    isActive: promo.isActive,
  };
}
