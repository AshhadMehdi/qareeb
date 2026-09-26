/**
 * Earnings wallet for merchants and riders.
 *
 * Nothing is "held" in a balance column: the ledger is derived from delivered
 * orders minus what has already been requested or paid out, so the numbers stay
 * honest when an order is cancelled or a payout is rejected.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import {
  orders,
  payoutRequests,
  runnerProfiles,
  shops,
  users,
  type PayoutRequestRow,
  type UserRole,
} from '../db/schema.js';
import { badRequest, conflict, notFound } from './errors.js';
import { newId } from './ids.js';
import { getSettings } from './settings.js';

/** Smallest withdrawal we allow, in PKR. */
export const MIN_PAYOUT = 500;

export type PayoutMethod = 'JAZZCASH' | 'EASYPAISA' | 'BANK';

const OPEN_STATUSES: PayoutRequestRow['status'][] = ['PENDING', 'APPROVED'];

export type WalletSummary = {
  /** gross money earned on delivered orders */
  earned: number;
  /** platform commission withheld (merchants only) */
  commission: number;
  tips: number;
  /** COD cash the rider is still carrying */
  cashInHand: number;
  paidOut: number;
  pending: number;
  available: number;
  minPayout: number;
  payouts: ReturnType<typeof serializePayout>[];
};

export function serializePayout(row: PayoutRequestRow) {
  return {
    id: row.id,
    userId: row.userId,
    role: row.role,
    shopId: row.shopId,
    amount: row.amount,
    method: row.method,
    accountTitle: row.accountTitle,
    accountNumber: row.accountNumber,
    status: row.status,
    note: row.note,
    decidedAt: row.decidedAt,
    decidedBy: row.decidedBy,
    createdAt: String(row.createdAt),
  };
}

type Account = { userId: string; role: UserRole; shopId: string | null; cashInHand: number };

/** What kind of wallet does this user have, and what does the platform owe them? */
export async function resolveAccount(userId: string): Promise<Account> {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound('Account not found');

  if (user.role === 'RIDER') {
    const [profile] = await db.select().from(runnerProfiles).where(eq(runnerProfiles.userId, userId)).limit(1);
    return { userId, role: 'RIDER', shopId: null, cashInHand: profile?.cashInHand ?? 0 };
  }

  const [shop] = await db.select({ id: shops.id }).from(shops).where(eq(shops.ownerId, userId)).limit(1);
  if (!shop) throw badRequest('Only merchants and riders have an earnings wallet');
  return { userId, role: 'MERCHANT', shopId: shop.id, cashInHand: 0 };
}

async function withdrawals(userId: string) {
  const db = await getDb();
  return db
    .select()
    .from(payoutRequests)
    .where(eq(payoutRequests.userId, userId))
    .orderBy(desc(payoutRequests.createdAt))
    .limit(30);
}

function summarise(rows: PayoutRequestRow[]) {
  const paidOut = rows.filter((row) => row.status === 'PAID').reduce((sum, row) => sum + row.amount, 0);
  const pending = rows.filter((row) => OPEN_STATUSES.includes(row.status)).reduce((sum, row) => sum + row.amount, 0);
  return { paidOut, pending };
}

/** Merchant wallet: delivered subtotal, minus commission, minus withdrawals. */
export async function merchantWallet(shopId: string): Promise<WalletSummary> {
  const db = await getDb();
  const settings = await getSettings();

  const delivered = await db
    .select({ subtotal: orders.subtotal })
    .from(orders)
    .where(and(eq(orders.shopId, shopId), eq(orders.status, 'DELIVERED')));

  const [shop] = await db.select({ ownerId: shops.ownerId }).from(shops).where(eq(shops.id, shopId)).limit(1);
  if (!shop) throw notFound('Shop not found');

  const gross = delivered.reduce((sum, row) => sum + row.subtotal, 0);
  const commission = Math.round((gross * settings.commissionPct) / 100);
  const rows = await withdrawals(shop.ownerId);
  const { paidOut, pending } = summarise(rows);

  return {
    earned: Math.round(gross),
    commission,
    tips: 0,
    cashInHand: 0,
    paidOut,
    pending,
    available: Math.max(0, Math.round(gross - commission - paidOut - pending)),
    minPayout: MIN_PAYOUT,
    payouts: rows.map(serializePayout),
  };
}

/** Rider wallet: delivery fees plus tips, minus the COD cash they still hold. */
export async function runnerWallet(userId: string): Promise<WalletSummary> {
  const db = await getDb();
  const account = await resolveAccount(userId);

  const delivered = await db
    .select({ deliveryFee: orders.deliveryFee, tip: orders.tip })
    .from(orders)
    .where(and(eq(orders.runnerId, userId), eq(orders.status, 'DELIVERED')));

  const fees = delivered.reduce((sum, row) => sum + row.deliveryFee, 0);
  const tips = delivered.reduce((sum, row) => sum + row.tip, 0);
  const rows = await withdrawals(userId);
  const { paidOut, pending } = summarise(rows);
  const owed = fees + tips - account.cashInHand;

  return {
    earned: Math.round(fees + tips),
    commission: 0,
    tips: Math.round(tips),
    cashInHand: Math.round(account.cashInHand),
    paidOut,
    pending,
    available: Math.max(0, Math.round(owed - paidOut - pending)),
    minPayout: MIN_PAYOUT,
    payouts: rows.map(serializePayout),
  };
}

export async function walletFor(userId: string): Promise<{ account: Account; wallet: WalletSummary }> {
  const account = await resolveAccount(userId);
  const wallet = account.role === 'MERCHANT' && account.shopId
    ? await merchantWallet(account.shopId)
    : await runnerWallet(userId);
  return { account, wallet };
}

export async function requestPayout(
  userId: string,
  input: { amount: number; method: PayoutMethod; accountTitle: string; accountNumber: string },
): Promise<PayoutRequestRow> {
  const db = await getDb();
  const { account, wallet } = await walletFor(userId);

  if (input.amount < wallet.minPayout) throw badRequest(`The smallest withdrawal is Rs ${wallet.minPayout}`);
  if (input.amount > wallet.available) throw conflict(`You can withdraw up to Rs ${wallet.available} right now`);

  const at = new Date().toISOString();
  const id = newId();
  await db.insert(payoutRequests).values({
    id,
    userId,
    role: account.role,
    shopId: account.shopId,
    amount: Math.round(input.amount),
    method: input.method,
    accountTitle: input.accountTitle,
    accountNumber: input.accountNumber,
    status: 'PENDING',
    createdAt: at,
    updatedAt: at,
  });
  const [row] = await db.select().from(payoutRequests).where(eq(payoutRequests.id, id)).limit(1);
  return row!;
}

/** Admin queue: every request with the account it belongs to. */
export async function payoutQueue(status?: string | null) {
  const db = await getDb();
  const rows = await db
    .select({ payout: payoutRequests, name: users.name, email: users.email, phone: users.phone, shopName: shops.name })
    .from(payoutRequests)
    .leftJoin(users, eq(users.id, payoutRequests.userId))
    .leftJoin(shops, eq(shops.id, payoutRequests.shopId))
    .where(status && status !== 'ALL' ? eq(payoutRequests.status, status as never) : undefined)
    .orderBy(desc(payoutRequests.createdAt))
    .limit(80);

  const totals = await db
    .select({
      status: payoutRequests.status,
      sum: sql<number>`coalesce(sum(${payoutRequests.amount}), 0)::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(payoutRequests)
    .groupBy(payoutRequests.status);

  return {
    payouts: rows.map((row) => ({
      ...serializePayout(row.payout),
      name: row.name,
      email: row.email,
      phone: row.phone,
      shopName: row.shopName,
    })),
    totals,
  };
}

export async function decidePayout(
  id: string,
  status: 'APPROVED' | 'PAID' | 'REJECTED',
  actorId: string,
  note?: string | null,
) {
  const db = await getDb();
  const [row] = await db.select().from(payoutRequests).where(eq(payoutRequests.id, id)).limit(1);
  if (!row) throw notFound('Payout request not found');
  if (row.status === 'PAID') throw conflict('That payout has already been paid');
  if (status === 'APPROVED' && row.status !== 'PENDING') throw conflict('Only pending requests can be approved');
  if (status === 'PAID' && !OPEN_STATUSES.includes(row.status)) throw conflict('That request is already closed');

  const at = new Date().toISOString();
  await db
    .update(payoutRequests)
    .set({ status, note: note ?? row.note ?? null, decidedBy: actorId, decidedAt: at, updatedAt: at })
    .where(eq(payoutRequests.id, id));

  const [updated] = await db.select().from(payoutRequests).where(eq(payoutRequests.id, id)).limit(1);
  return updated!;
}
