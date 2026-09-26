export type Role = 'CUSTOMER' | 'MERCHANT' | 'RIDER' | 'ADMIN';

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

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  walletPoints: number;
  createdAt?: string;
};

export type Address = {
  id: string;
  label: string;
  line1: string;
  area: string | null;
  city: string;
  lat: number;
  lng: number;
  instructions: string | null;
  isDefault?: boolean;
};

export type Shop = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  phone: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  addressLine: string;
  area: string;
  lat: number;
  lng: number;
  city: string;
  isOpen: boolean;
  isPaused?: boolean;
  openNow: boolean;
  hours: Record<string, { open: string; close: string; closed?: boolean }>;
  prepTimeMin: number;
  minOrder: number;
  ratingAvg: number;
  ratingCount: number;
  status?: string;
  tags: string[];
  deliveryMode?: string;
  ownerName?: string | null;
  productCount: number;
  isFavorite: boolean;
  distanceKm: number;
  deliveryFee: number;
  etaMinutes: number;
  deliverable: boolean;
  freeDelivery: boolean;
  zoneName: string | null;
};

export type Product = {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  emoji: string | null;
  stock: number;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
};

export type ProductSearchHit = Product & {
  shop: {
    id: string;
    name: string;
    slug: string;
    category: string;
    openNow: boolean;
    distanceKm: number;
    deliveryFee: number;
    etaMinutes: number;
  };
};

export type OrderItem = {
  id: string;
  productId: string | null;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  total: number;
  note: string | null;
  emoji: string | null;
  imageUrl: string | null;
};

export type Order = {
  id: string;
  orderNumber: string;
  groupId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentRef: string | null;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  tip: number;
  total: number;
  distanceKm: number;
  etaMinutes: number;
  promoCode: string | null;
  notes: string | null;
  deliveryAddress: {
    label: string;
    line1: string;
    area?: string | null;
    city: string;
    lat: number;
    lng: number;
    instructions?: string | null;
    phone?: string | null;
  };
  statusHistory: { status: OrderStatus; at: string; note?: string }[];
  scheduledFor: string | null;
  acceptedAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  pointsEarned: number;
  pointsRedeemed: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  shop: {
    id: string;
    name: string;
    slug: string;
    category?: string | null;
    coverUrl?: string | null;
    prepTimeMin?: number;
    lat: number;
    lng: number;
    addressLine: string;
    phone: string | null;
  } | null;
  runner: { id: string; name: string; phone: string | null; lat: number | null; lng: number | null } | null;
  customer?: { id: string; name: string; phone: string | null } | null;
  hasReview: boolean;
};

export type QuoteGroup = {
  shopId: string;
  shop: { id: string; name: string; slug: string; category: string };
  items: OrderItem[];
  warnings: string[];
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
  pointsEarnable: number;
  promoError?: string;
};

export type Quote = {
  groups: QuoteGroup[];
  summary: {
    subtotal: number;
    deliveryFee: number;
    serviceFee: number;
    discount: number;
    tip: number;
    total: number;
  };
  destination: { lat: number; lng: number };
  points: { available: number; maxRedeemable: number; applied: number; payable: number };
  settings: { serviceFeePct: number; cancelWindowMinutes: number; cityName: string };
  address: Address | null;
};

export type AppConfig = {
  appName: string;
  city: string;
  demoPassword: string | null;
  googleClientId: string | null;
  pushEnabled: boolean;
  currency: string;
  ready: boolean;
  center: { lat: number; lng: number };
  announcement: string;
  supportPhone: string;
  payments: { cod: boolean; jazzcash: boolean; easypaisa: boolean; wallet: boolean; card: boolean; mode: string };
  paymentMethods: { method: PaymentMethod; provider: string; mode: string }[];
  limits: { maxUploadBytes: number; radiusCapKm: number; cancelWindowMinutes: number };
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

export type RunnerProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl?: string | null;
  vehicleType: 'bike' | 'car' | 'van' | 'bicycle';
  isAvailable: boolean;
  lat: number | null;
  lng: number | null;
  lastSeenAt?: string | null;
  ratingAvg: number;
  ratingCount: number;
  totalDeliveries: number;
  cashInHand: number;
  activeOrders?: number;
  distanceKm?: number | null;
};

export type Promo = {
  id: string;
  code: string;
  title: string | null;
  shopId: string | null;
  type: 'PERCENT' | 'FIXED' | 'FREE_DELIVERY';
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  expiresAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
};

export type DeliveryZone = {
  id: string;
  shopId: string;
  name: string;
  radiusKm: number;
  fee: number;
  freeAbove: number | null;
  etaMinutes: number;
  sortOrder: number;
};

export type RealtimeEvent = {
  id: number;
  room: string;
  event: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
