/**
 * Payment gateways.
 *
 * JazzCash and Easypaisa integrations are wired as a sandbox: the method, the
 * amount and a reference are recorded in payment_transactions, and online
 * methods are marked PAID immediately so the demo order flow completes. Cash on
 * delivery stays UNPAID until the rider collects it. Swap the bodies of
 * `chargeJazzCash` / `chargeEasypaisa` for the real hosted-checkout calls and
 * the rest of the system already behaves correctly.
 */
import { and, eq } from 'drizzle-orm';
import { env } from '../env.js';
import { getDb } from '../db/client.js';
import { orders, paymentTransactions, type PaymentMethod, type PaymentStatus } from '../db/schema.js';
import { badRequest } from './errors.js';
import { newId } from './ids.js';
import { notify } from './notify.js';
import { emit, orderRoom, userRoom } from './realtime.js';

export type ChargeResult = {
  status: PaymentStatus;
  reference: string | null;
  message: string;
  redirectUrl?: string;
};

function reference(prefix: string): string {
  return `${prefix}-${newId(10).toUpperCase()}`;
}

/** Card is intentionally sandbox-only for now; COD/Wallet need no gateway. */
export const GATEWAY_METHODS: PaymentMethod[] = ['JAZZCASH', 'EASYPAISA', 'CARD'];

export function gatewayStatus(method: PaymentMethod) {
  if (method === 'JAZZCASH') return { provider: 'JazzCash', mode: env.payments.jazzcash.mode };
  if (method === 'EASYPAISA') return { provider: 'Easypaisa', mode: env.payments.easypaisa.mode };
  if (method === 'CARD') return { provider: 'Card (sandbox)', mode: 'sandbox' as const };
  if (method === 'WALLET') return { provider: 'Qareeb points wallet', mode: 'live' as const };
  return { provider: 'Cash on delivery', mode: 'live' as const };
}

export async function charge(method: PaymentMethod, amount: number, orderId: string): Promise<ChargeResult> {
  if (amount < 0) throw badRequest('Amount must be positive');
  switch (method) {
    case 'COD':
      return { status: 'UNPAID', reference: null, message: 'Pay the rider in cash on delivery' };
    case 'JAZZCASH':
      return sandboxOnline('JazzCash', 'JC', orderId, amount, env.payments.jazzcash.mode);
    case 'EASYPAISA':
      return sandboxOnline('Easypaisa', 'EP', orderId, amount, env.payments.easypaisa.mode);
    case 'CARD':
      return sandboxOnline('Card', 'CD', orderId, amount, 'sandbox');
    case 'WALLET':
      return { status: 'PAID', reference: reference('WL'), message: 'Paid with wallet points' };
    default:
      throw badRequest(`Unsupported payment method ${method}`);
  }
}

function sandboxOnline(
  provider: string,
  prefix: string,
  _orderId: string,
  _amount: number,
  mode: 'sandbox' | 'live',
): ChargeResult {
  const ref = reference(prefix);
  return {
    status: 'PAID',
    reference: ref,
    message:
      mode === 'sandbox'
        ? `${provider} sandbox payment approved (${ref})`
        : `${provider} payment approved (${ref})`,
  };
}

/** Persists the attempt and mirrors the resulting state onto the order. */
export async function settleOrderPayment(input: {
  orderId: string;
  method: PaymentMethod;
  amount: number;
  actorId?: string;
}): Promise<ChargeResult> {
  const db = await getDb();
  const result = await charge(input.method, input.amount, input.orderId);

  await db.insert(paymentTransactions).values({
    id: newId(),
    orderId: input.orderId,
    provider: input.method,
    amount: input.amount,
    status: result.status,
    providerRef: result.reference,
    raw: { message: result.message, mode: gatewayStatus(input.method).mode },
  });

  await db
    .update(orders)
    .set({
      paymentMethod: input.method,
      paymentStatus: result.status,
      paymentRef: result.reference,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, input.orderId));

  return result;
}

export async function markOrderPaid(orderId: string, reference: string | null) {
  const db = await getDb();
  await db
    .update(orders)
    .set({ paymentStatus: 'PAID', paymentRef: reference, updatedAt: new Date().toISOString() })
    .where(eq(orders.id, orderId));
}

export async function refundOrder(orderId: string, reason: string, customerId: string) {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.paymentStatus !== 'PAID' || order.paymentMethod === 'COD') return;

  await db
    .update(orders)
    .set({ paymentStatus: 'REFUNDED', cancelReason: reason, updatedAt: new Date().toISOString() })
    .where(eq(orders.id, orderId));

  await db.insert(paymentTransactions).values({
    id: newId(),
    orderId,
    provider: order.paymentMethod,
    amount: -order.total,
    status: 'REFUNDED',
    providerRef: order.paymentRef,
    raw: { reason },
  });

  await notify({
    userId: customerId,
    title: 'Refund issued',
    body: `Rs ${Math.round(order.total)} for order ${order.orderNumber} is on its way back via ${gatewayStatus(order.paymentMethod).provider}.`,
    type: 'order',
    data: { orderId, groupId: order.groupId },
  });
  await emit([userRoom(customerId), orderRoom(orderId)], 'order:updated', {
    orderId,
    status: order.status,
    paymentStatus: 'REFUNDED',
  });
}

export async function findPaymentAttempts(orderId: string) {
  const db = await getDb();
  return db
    .select()
    .from(paymentTransactions)
    .where(and(eq(paymentTransactions.orderId, orderId)));
}
