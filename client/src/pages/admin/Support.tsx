import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, Skeleton, Tag } from '../../components/ui';
import { useAdminTicketMutations, useAdminTickets } from '../../lib/queries';
import { timeAgo } from '../../lib/format';

const FILTERS = ['ALL', 'OPEN', 'ANSWERED', 'RESOLVED'];

export default function AdminSupport() {
  const [filter, setFilter] = useState('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const tickets = useAdminTickets(filter);
  const { reply: send, setStatus } = useAdminTicketMutations();

  const counts = tickets.data?.counts;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-forest-800">Support</h1>
          <p className="text-sm text-ink-500">
            {counts?.open ?? 0} open · {counts?.answered ?? 0} answered · {counts?.high ?? 0} high priority
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip ${filter === option ? 'chip-active' : ''}`}
              onClick={() => setFilter(option)}
            >
              {option.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {tickets.isLoading ? <Skeleton className="h-40 w-full" /> : null}

      <div className="space-y-3">
        {(tickets.data?.tickets ?? []).map((ticket) => {
          const open = openId === ticket.id;
          return (
            <section key={ticket.id} className="card p-4">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => {
                  setOpenId(open ? null : ticket.id);
                  setReply('');
                }}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-forest-800">{ticket.subject}</p>
                    <Tag tone={ticket.status === 'RESOLVED' ? 'forest' : ticket.status === 'ANSWERED' ? 'cream' : 'wheat'}>
                      {ticket.status.toLowerCase()}
                    </Tag>
                    {ticket.priority === 'high' ? <Tag tone="clay">high</Tag> : null}
                    <Tag>{ticket.category.toLowerCase()}</Tag>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {ticket.name} · {ticket.role?.toLowerCase()} · {ticket.email} · {timeAgo(ticket.updatedAt)}
                    {ticket.orderId ? ` · order ${ticket.orderId.slice(0, 8)}` : ''}
                  </p>
                </div>
                <span className="text-xs text-ink-500">{ticket.messages.length} messages</span>
              </button>

              {open ? (
                <div className="mt-3 space-y-2 border-t border-cream-200 pt-3">
                  {ticket.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-2xl p-3 text-sm ${
                        message.authorRole === 'ADMIN' ? 'bg-forest-50 text-forest-800' : 'bg-cream-100 text-ink-700'
                      }`}
                    >
                      <p className="text-xs font-semibold">
                        {message.authorName ?? 'User'} · {message.authorRole.toLowerCase()} · {timeAgo(message.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                    </div>
                  ))}

                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!reply.trim()) return;
                      try {
                        await send.mutateAsync({ id: ticket.id, body: reply.trim() });
                        setReply('');
                        toast.success('Reply sent');
                      } catch (error) {
                        toast.error((error as Error).message);
                      }
                    }}
                  >
                    <input
                      className="input flex-1"
                      placeholder="Write a reply…"
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                    />
                    <button type="submit" className="btn btn-primary" disabled={send.isPending}>
                      Reply
                    </button>
                    {ticket.status !== 'RESOLVED' ? (
                      <button
                        type="button"
                        className="btn btn-quiet"
                        onClick={async () => {
                          try {
                            await setStatus.mutateAsync({ id: ticket.id, status: 'RESOLVED' });
                            toast.success('Ticket resolved');
                          } catch (error) {
                            toast.error((error as Error).message);
                          }
                        }}
                      >
                        Resolve
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={async () => {
                          await setStatus.mutateAsync({ id: ticket.id, status: 'OPEN' });
                          toast.success('Ticket reopened');
                        }}
                      >
                        Reopen
                      </button>
                    )}
                  </form>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {!tickets.isLoading && !tickets.data?.tickets.length ? (
        <EmptyState
          title="No tickets in this view"
          body="Customers, merchants and riders can raise issues from their account or an order; they appear here."
        />
      ) : null}
    </div>
  );
}
