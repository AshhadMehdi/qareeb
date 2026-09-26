/**
 * Support tickets: a customer, merchant or rider raises an issue (optionally
 * about an order) and admins answer from the console.
 */
import { asc, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders, supportTickets, ticketMessages, users, type SupportTicketRow } from '../db/schema.js';
import { forbidden, notFound } from './errors.js';
import { newId } from './ids.js';
import { notify } from './notify.js';

type Actor = { id: string; role: string; name?: string };

type TicketInput = {
  subject: string;
  category: string;
  body: string;
  orderId?: string | null;
  priority?: string;
};

function serialize(ticket: SupportTicketRow, extras: Record<string, unknown> = {}) {
  return {
    id: ticket.id,
    userId: ticket.userId,
    orderId: ticket.orderId,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: String(ticket.createdAt),
    updatedAt: String(ticket.updatedAt),
    ...extras,
  };
}

async function thread(ticketId: string) {
  const db = await getDb();
  const rows = await db
    .select({ message: ticketMessages, authorName: users.name, authorRole: ticketMessages.authorRole })
    .from(ticketMessages)
    .leftJoin(users, eq(users.id, ticketMessages.authorId))
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(asc(ticketMessages.createdAt));

  return rows.map((row) => ({
    id: row.message.id,
    authorId: row.message.authorId,
    authorName: row.authorName,
    authorRole: row.message.authorRole,
    body: row.message.body,
    createdAt: String(row.message.createdAt),
  }));
}

export async function openTicket(actor: Actor, input: TicketInput) {
  const db = await getDb();
  const at = new Date().toISOString();
  const id = newId();
  const orderId = input.orderId ?? null;

  if (orderId) {
    const [order] = await db.select({ id: orders.id, customerId: orders.customerId, shopId: orders.shopId }).from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) throw notFound('That order does not exist');
  }

  await db.insert(supportTickets).values({
    id,
    userId: actor.id,
    orderId,
    subject: input.subject,
    category: input.category,
    priority: input.priority ?? 'normal',
    status: 'OPEN',
    createdAt: at,
    updatedAt: at,
  });
  await db.insert(ticketMessages).values({
    id: newId(),
    ticketId: id,
    authorId: actor.id,
    authorRole: actor.role as never,
    body: input.body,
    createdAt: at,
  });

  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  return serialize(ticket!, { messages: await thread(id) });
}

export async function ticketsFor(userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.updatedAt))
    .limit(40);

  const tickets = [];
  for (const row of rows) tickets.push(serialize(row, { messages: await thread(row.id) }));
  return { tickets, open: rows.filter((row) => row.status !== 'RESOLVED').length };
}

export async function allTickets(status?: string | null) {
  const db = await getDb();
  const rows = await db
    .select({ ticket: supportTickets, name: users.name, email: users.email, role: users.role })
    .from(supportTickets)
    .leftJoin(users, eq(users.id, supportTickets.userId))
    .where(status && status !== 'ALL' ? eq(supportTickets.status, status as never) : undefined)
    .orderBy(desc(supportTickets.updatedAt))
    .limit(80);

  const tickets = [];
  for (const row of rows) {
    tickets.push(serialize(row.ticket, { name: row.name, email: row.email, role: row.role, messages: await thread(row.ticket.id) }));
  }
  return {
    tickets,
    counts: {
      open: rows.filter((row) => row.ticket.status === 'OPEN').length,
      answered: rows.filter((row) => row.ticket.status === 'ANSWERED').length,
      resolved: rows.filter((row) => row.ticket.status === 'RESOLVED').length,
      high: rows.filter((row) => row.ticket.priority === 'high' && row.ticket.status !== 'RESOLVED').length,
    },
  };
}

export async function replyToTicket(actor: Actor, ticketId: string, body: string) {
  const db = await getDb();
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket) throw notFound('Ticket not found');

  const isAdmin = actor.role === 'ADMIN';
  if (!isAdmin && ticket.userId !== actor.id) throw forbidden('That ticket belongs to someone else');

  const at = new Date().toISOString();
  await db.insert(ticketMessages).values({
    id: newId(),
    ticketId,
    authorId: actor.id,
    authorRole: actor.role as never,
    body,
    createdAt: at,
  });
  await db
    .update(supportTickets)
    .set({ status: isAdmin ? 'ANSWERED' : 'OPEN', updatedAt: at })
    .where(eq(supportTickets.id, ticketId));

  if (isAdmin) {
    await notify({
      userId: ticket.userId,
      title: 'Support replied',
      body: body.slice(0, 120),
      type: 'support',
      data: { ticketId },
    });
  }

  const [updated] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  return serialize(updated!, { messages: await thread(ticketId) });
}

export async function setTicketStatus(ticketId: string, status: 'OPEN' | 'ANSWERED' | 'RESOLVED') {
  const db = await getDb();
  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!ticket) throw notFound('Ticket not found');
  await db.update(supportTickets).set({ status, updatedAt: new Date().toISOString() }).where(eq(supportTickets.id, ticketId));
  const [updated] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  return serialize(updated!, { messages: await thread(ticketId) });
}
