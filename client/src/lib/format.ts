/** Rupees, distances and times the way people in Abbottabad read them. */
export function rupees(amount: number, options: { decimals?: boolean } = {}): string {
  const value = options.decimals ? amount : Math.round(amount);
  return `Rs ${value.toLocaleString('en-PK', {
    maximumFractionDigits: options.decimals ? 0 : 0,
    minimumFractionDigits: 0,
  })}`;
}

export function distance(km: number): string {
  if (!km) return 'nearby';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function minutes(value: number): string {
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' });
}

export function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Assalam o alaikum';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const PAYMENT_LABELS: Record<string, string> = {
  COD: 'Cash on delivery',
  JAZZCASH: 'JazzCash',
  EASYPAISA: 'Easypaisa',
  CARD: 'Card',
  WALLET: 'Qareeb points',
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Waiting for the shop',
  ACCEPTED: 'Accepted',
  PREPARING: 'Being packed',
  READY: 'Ready for pickup',
  ON_THE_WAY: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const ORDER_STEPS = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED'] as const;

export function statusTone(status: string): string {
  switch (status) {
    case 'DELIVERED':
      return 'bg-forest-100 text-forest-700 border-forest-200';
    case 'CANCELLED':
      return 'bg-clay-100 text-clay-600 border-clay-100';
    case 'ON_THE_WAY':
      return 'bg-wheat-100 text-wheat-500 border-wheat-100';
    case 'PENDING':
      return 'bg-cream-200 text-ink-700 border-cream-300';
    default:
      return 'bg-forest-50 text-forest-600 border-forest-100';
  }
}

/** Recharts tooltips hand us ValueType; this keeps the formatter typed and money-shaped. */
export function tooltipMoney(label: string) {
  return (value: unknown) => [rupees(Number(value)), label] as [string, string];
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function pluralize(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Delivery windows read better as a range: 35 min → "30–40 min". */
export function etaRange(minutes: number): string {
  const low = Math.max(10, Math.round((minutes - 5) / 5) * 5);
  const high = Math.round((minutes + 5) / 5) * 5;
  return `${low}–${high} min`;
}
