/**
 * Money rules. All amounts are PKR, rounded to whole rupees at the edge.
 */
import type { PromoRow } from '../db/schema.js';
import { badRequest } from './errors.js';

export const roundMoney = (value: number) => Math.round(value);

export type PlatformSettings = {
  cityName: string;
  cityLat: number;
  cityLng: number;
  serviceFeePct: number;
  /** platform take from the food/goods subtotal */
  commissionPct: number;
  /** loyalty points credited per 100 PKR of subtotal */
  loyaltyPointsPer100: number;
  radiusCapKm: number;
  cancelWindowMinutes: number;
  minOrderDefault: number;
  supportPhone: string;
  announcement: string;
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  cityName: 'Abbottabad',
  cityLat: 34.1688,
  cityLng: 73.2215,
  serviceFeePct: 2,
  commissionPct: 8,
  loyaltyPointsPer100: 2,
  radiusCapKm: 12,
  cancelWindowMinutes: 5,
  minOrderDefault: 0,
  supportPhone: '+92 992 920 000',
  announcement: 'Free delivery on orders above Rs 800 within Mandian and Supply Bazaar.',
};

export function applyPromo(
  promo: PromoRow,
  input: { subtotal: number; deliveryFee: number },
): { discount: number; freeDelivery: boolean } {
  if (!promo.isActive) throw badRequest('This promo code is no longer active');
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now()) {
    throw badRequest('This promo code has expired');
  }
  if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) {
    throw badRequest('This promo code has been fully claimed');
  }
  if (input.subtotal < promo.minOrder) {
    throw badRequest(`Add Rs ${roundMoney(promo.minOrder - input.subtotal)} more to use ${promo.code}`);
  }

  if (promo.type === 'FREE_DELIVERY') {
    return { discount: roundMoney(input.deliveryFee), freeDelivery: true };
  }
  if (promo.type === 'PERCENT') {
    const raw = (input.subtotal * promo.value) / 100;
    return { discount: roundMoney(promo.maxDiscount ? Math.min(raw, promo.maxDiscount) : raw), freeDelivery: false };
  }
  const capped = promo.maxDiscount ? Math.min(promo.value, promo.maxDiscount) : promo.value;
  return { discount: roundMoney(Math.min(capped, input.subtotal)), freeDelivery: false };
}

export function serviceFeeFor(subtotal: number, pct: number): number {
  return roundMoney((subtotal * pct) / 100);
}

export function pointsFor(subtotal: number, pointsPer100: number): number {
  return Math.floor((subtotal / 100) * pointsPer100);
}

export const pointsToRupees = (points: number) => Math.floor(points);
