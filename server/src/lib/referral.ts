/**
 * Refer & earn: every account owns a share code, and the reward is paid out
 * once the invited customer's first order is actually delivered — the same
 * abuse guard the commercial clones use.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders, users, type OrderRow } from '../db/schema.js';
import { newId } from './ids.js';
import { notify } from './notify.js';

/** Points are 1:1 with PKR when spent, so these are real discounts. */
export const REFERRER_REWARD = 150;
export const REFEREE_REWARD = 75;

function makeCode(name: string, id: string): string {
  const first = (name.trim().split(/\s+/)[0] ?? 'QAREEB').replace(/[^a-z]/gi, '').toUpperCase().slice(0, 6);
  const tail = id.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
  return `${first || 'QAREEB'}-${tail}`;
}

/** Codes are generated lazily so rows seeded before this feature still work. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return '';
  if (user.referralCode) return user.referralCode;

  let code = makeCode(user.name, user.id);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, code)).limit(1);
    if (!taken || taken.id === userId) break;
    code = makeCode(user.name, `${user.id}${newId()}`);
  }

  await db.update(users).set({ referralCode: code, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
  return code;
}

export async function findReferrer(code: string) {
  const db = await getDb();
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return null;
  const [row] = await db.select().from(users).where(eq(users.referralCode, cleaned)).limit(1);
  return row ?? null;
}

/** Called from both places an order can be marked delivered (shop and rider). */
export async function creditReferralOnDelivery(order: OrderRow): Promise<boolean> {
  if (order.status !== 'DELIVERED') return false;
  const db = await getDb();
  const [customer] = await db.select().from(users).where(eq(users.id, order.customerId)).limit(1);
  if (!customer || !customer.referredBy || customer.referralCreditedAt) return false;

  // only the first delivered order counts
  const delivered = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.customerId, customer.id), eq(orders.status, 'DELIVERED')))
    .limit(2);
  if (delivered.length !== 1) return false;

  const [referrer] = await db.select().from(users).where(eq(users.referralCode, customer.referredBy)).limit(1);
  const at = new Date().toISOString();

  if (referrer && referrer.id !== customer.id) {
    await db
      .update(users)
      .set({ walletPoints: referrer.walletPoints + REFERRER_REWARD, updatedAt: at })
      .where(eq(users.id, referrer.id));
    await notify({
      userId: referrer.id,
      title: `You earned ${REFERRER_REWARD} points`,
      body: `${customer.name} used your invite code and their first order was delivered.`,
      type: 'reward',
      data: { points: REFERRER_REWARD },
    });
  }

  await db
    .update(users)
    .set({
      walletPoints: customer.walletPoints + REFEREE_REWARD,
      referralCreditedAt: at,
      updatedAt: at,
    })
    .where(eq(users.id, customer.id));
  await notify({
    userId: customer.id,
    title: `Welcome bonus: ${REFEREE_REWARD} points`,
    body: 'Your invite bonus has landed in your Qareeb wallet.',
    type: 'reward',
    data: { points: REFEREE_REWARD },
  });

  return true;
}

export async function referralSummary(userId: string) {
  const db = await getDb();
  const code = await ensureReferralCode(userId);
  const invited = await db
    .select({
      id: users.id,
      name: users.name,
      joinedAt: users.createdAt,
      creditedAt: users.referralCreditedAt,
    })
    .from(users)
    .where(eq(users.referredBy, code))
    .limit(50);

  const credited = invited.filter((row) => row.creditedAt);
  return {
    code,
    reward: { referrer: REFERRER_REWARD, referee: REFEREE_REWARD },
    invited: invited.map((row) => ({
      id: row.id,
      name: row.name,
      joinedAt: String(row.joinedAt),
      credited: Boolean(row.creditedAt),
    })),
    stats: { invited: invited.length, converted: credited.length, earned: credited.length * REFERRER_REWARD },
  };
}

/** Used by the admin console to show referral reach at a glance. */
export async function referralTotals() {
  const db = await getDb();
  const rows = await db
    .select({ referredBy: users.referredBy, creditedAt: users.referralCreditedAt })
    .from(users)
    .where(inArray(users.role, ['CUSTOMER']));
  const invited = rows.filter((row) => row.referredBy).length;
  const converted = rows.filter((row) => row.referredBy && row.creditedAt).length;
  return { invited, converted, pointsIssued: converted * (REFERRER_REWARD + REFEREE_REWARD) };
}
