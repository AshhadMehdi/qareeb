/**
 * Distance maths and delivery rings.
 *
 * Every shop owns up to six concentric rings (radiusKm → fee, freeAbove). The
 * first ring that reaches the customer sets the fee and ETA; outside the widest
 * ring the shop is still listed but marked not deliverable.
 */
import type { DeliveryZoneRow, OpeningHours } from '../db/schema.js';

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function roundKm(km: number): number {
  return Math.round(km * 10) / 10;
}

export type ZoneQuote = {
  deliverable: boolean;
  zone: DeliveryZoneRow | null;
  fee: number;
  freeDelivery: boolean;
  etaMinutes: number;
  distanceKm: number;
};

export function quoteZone(
  shop: { lat: number; lng: number; prepTimeMin: number },
  destination: { lat: number; lng: number },
  zones: DeliveryZoneRow[],
  subtotal = 0,
): ZoneQuote {
  const km = roundKm(distanceKm(shop, destination));
  const sorted = [...zones].sort((a, b) => a.radiusKm - b.radiusKm);
  const ring = sorted.find((zone) => km <= zone.radiusKm) ?? null;
  // Time to your gate = how long the shop needs to make it, plus the ride.
  const travel = ring?.etaMinutes ?? Math.round(km * 3) + 10;
  const eta = travel + shop.prepTimeMin;

  if (!ring) {
    return {
      deliverable: false,
      zone: null,
      fee: 0,
      freeDelivery: false,
      etaMinutes: shop.prepTimeMin + Math.round(km * 3) + 15,
      distanceKm: km,
    };
  }

  const freeDelivery = ring.freeAbove != null && subtotal >= ring.freeAbove;
  return {
    deliverable: true,
    zone: ring,
    fee: freeDelivery ? 0 : ring.fee,
    freeDelivery,
    etaMinutes: eta,
    distanceKm: km,
  };
}

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/** Opening hours are stored per weekday in local (Asia/Karachi) time. */
export function isOpenNow(hours: OpeningHours, at = new Date()): boolean {
  const key = WEEKDAYS[(at.getDay() + 6) % 7];
  const today = hours?.[key];
  if (!today || today.closed) return false;
  const minutes = at.getHours() * 60 + at.getMinutes();
  const parse = (value: string) => {
    const [h = '0', m = '0'] = value.split(':');
    return Number(h) * 60 + Number(m);
  };
  const open = parse(today.open);
  const close = parse(today.close);
  if (close < open) return minutes >= open || minutes <= close; // overnight
  return minutes >= open && minutes <= close;
}

export function defaultHours(): OpeningHours {
  const hours: OpeningHours = {};
  for (const day of WEEKDAYS) {
    hours[day] = day === 'sunday' ? { open: '10:00', close: '20:00' } : { open: '08:00', close: '23:00' };
  }
  return hours;
}

/** Auto-assign scoring: closer riders with a lighter load and a shop team tie win. */
export function riderScore(input: {
  riderLat: number | null;
  riderLng: number | null;
  shopLat: number;
  shopLng: number;
  activeOrders: number;
  isTeamMember: boolean;
}): number {
  const distance =
    input.riderLat != null && input.riderLng != null
      ? distanceKm({ lat: input.riderLat, lng: input.riderLng }, { lat: input.shopLat, lng: input.shopLng })
      : 8;
  return distance + input.activeOrders * 1.5 - (input.isTeamMember ? 1.25 : 0);
}
