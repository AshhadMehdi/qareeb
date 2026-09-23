/**
 * User-facing copy that more than one route needs. Keeping it here stops the
 * same sentence drifting into three slightly different versions.
 */
export function promoAppliedMessage(code: string, discount: number): string {
  return discount > 0 ? `${code} applied — Rs ${discount} off this order.` : `${code} applied.`;
}

export function cashToCollectMessage(amount: number): string {
  return `Collect Rs ${Math.round(amount)} in cash.`;
}

export function riderAssignedMessage(riderName: string | null): string {
  return riderName ? `${riderName} is picking up your order.` : 'A rider is being assigned.';
}

export function otpMessage(code: string): string {
  return `Share delivery code ${code} with the rider only when you receive your order.`;
}

export const ORDER_STATUS_COPY = {
  PENDING: 'Order placed',
  ACCEPTED: 'Shop accepted your order',
  PREPARING: 'Your order is being packed',
  READY: 'Packed and waiting for a rider',
  ON_THE_WAY: 'Your rider is on the way',
  DELIVERED: 'Delivered — enjoy!',
  CANCELLED: 'Order cancelled',
} as const;
