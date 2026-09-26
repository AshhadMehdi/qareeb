import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState, ErrorNote, Skeleton, StatusPill, Tag } from '../../components/ui';
import { ChatPanel } from '../../components/OrderPieces';
import { useAssignRunner, useMerchantOrders, useMerchantRunners, useSetOrderStatus } from '../../lib/queries';
import { apiPost } from '../../lib/api';
import { PAYMENT_LABELS, clockTime, rupees } from '../../lib/format';
import { useAuth } from '../../store/auth';
import type { Order } from '../../lib/types';

const TABS = [
  { key: 'ACTIVE', label: 'Live' },
  { key: 'PENDING', label: 'New' },
  { key: 'READY', label: 'Ready' },
  { key: 'DELIVERED', label: 'Completed' },
  { key: 'ALL', label: 'All' },
];

const NEXT_ACTION: Record<string, { status: string; label: string } | null> = {
  PENDING: { status: 'ACCEPTED', label: 'Accept order' },
  ACCEPTED: { status: 'PREPARING', label: 'Start packing' },
  PREPARING: { status: 'READY', label: 'Mark ready' },
  READY: { status: 'ON_THE_WAY', label: 'Hand to rider' },
  ON_THE_WAY: { status: 'DELIVERED', label: 'Mark delivered' },
  DELIVERED: null,
  CANCELLED: null,
};

export default function MerchantOrders() {
  const [tab, setTab] = useState('ACTIVE');
  const orders = useMerchantOrders(tab);
  const setStatus = useSetOrderStatus();
  const assign = useAssignRunner();
  const runners = useMerchantRunners();
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [openChat, setOpenChat] = useState<string | null>(null);

  const list = orders.data?.orders ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-forest-800">Orders</h1>
          <p className="text-sm text-ink-500">
            {orders.data?.counts.pending ?? 0} new · {orders.data?.counts.preparing ?? 0} packing ·{' '}
            {orders.data?.counts.ready ?? 0} ready · {orders.data?.counts.onTheWay ?? 0} with riders
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`chip ${tab === option.key ? 'chip-active' : ''}`}
              onClick={() => setTab(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {orders.isLoading ? <Skeleton className="h-32 w-full" /> : null}

      {!orders.isLoading && !list.length ? (
        <EmptyState title="No orders in this view" body="New orders ring in here automatically." />
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onStatus={async (status, extra) => {
              try {
                await setStatus.mutateAsync({ id: order.id, status, ...extra });
                toast.success(`Order ${status.toLowerCase()}`);
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
            onAssign={async (runnerId) => {
              try {
                const result = await assign.mutateAsync({ id: order.id, runnerId });
                toast.success(result.runner ? `${result.runner.name} assigned` : 'Rider assigned');
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
            runners={[
              { id: 'auto', name: 'Auto-assign nearest rider' },
              ...(runners.data?.team ?? []).map((runner) => ({
                id: runner.id,
                name: `${runner.name} · team · ${runner.activeOrders ?? 0} active`,
              })),
              ...(runners.data?.nearby ?? []).map((runner) => ({
                id: runner.id,
                name: `${runner.name} · ${runner.distanceKm ?? '?'} km${runner.isAvailable ? '' : ' · offline'}`,
              })),
            ]}
            rejectOpen={rejectFor === order.id}
            onRejectOpen={(open) => {
              setRejectFor(open ? order.id : null);
              setReason('');
            }}
            reason={reason}
            setReason={setReason}
            chatOpen={openChat === order.id}
            onToggleChat={() => setOpenChat(openChat === order.id ? null : order.id)}
          />
        ))}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  onStatus,
  onAssign,
  runners,
  rejectOpen,
  onRejectOpen,
  reason,
  setReason,
  chatOpen,
  onToggleChat,
}: {
  order: Order;
  onStatus: (status: string, extra?: { reason?: string }) => void;
  onAssign: (runnerId: string) => void;
  runners: { id: string; name: string }[];
  rejectOpen: boolean;
  onRejectOpen: (open: boolean) => void;
  reason: string;
  setReason: (value: string) => void;
  chatOpen: boolean;
  onToggleChat: () => void;
}) {
  const user = useAuth((state) => state.user);
  const action = NEXT_ACTION[order.status];
  const [messages, setMessages] = useState<{ id: string; senderId: string; senderRole: string; body: string; createdAt: string }[]>([]);
  const [sending, setSending] = useState(false);

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-forest-800">{order.orderNumber}</p>
          <p className="text-xs text-ink-500">
            {clockTime(order.createdAt)} · {order.customer?.name ?? 'Customer'}
            {order.customer?.phone ? ` · ${order.customer.phone}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {order.scheduledFor ? <Tag tone="wheat">scheduled</Tag> : null}
          <StatusPill status={order.status} />
        </div>
      </div>

      {order.scheduledFor ? (
        <p className="mt-2 rounded-2xl border border-wheat-100 bg-wheat-100/40 px-3 py-2 text-xs text-ink-700">
          Customer asked for{' '}
          <span className="font-semibold">
            {new Date(order.scheduledFor).toLocaleString('en-PK', {
              hour: 'numeric',
              minute: '2-digit',
              day: 'numeric',
              month: 'short',
            })}
          </span>{' '}
          — prepare it to be ready just before then.
        </p>
      ) : null}

      <ul className="mt-3 space-y-1 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-ink-700">
              {item.quantity} × {item.name}
              {item.note ? <span className="text-ink-500"> · {item.note}</span> : null}
            </span>
            <span className="tabular-nums text-ink-900">{rupees(item.total)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-cream-100 p-3 text-xs">
        <div>
          <p className="label">Deliver to</p>
          <p className="mt-0.5 text-ink-700">
            {order.deliveryAddress.label} · {order.deliveryAddress.area ?? 'Abbottabad'}
          </p>
          <p className="text-ink-500">{order.deliveryAddress.line1}</p>
        </div>
        <div>
          <p className="label">Payment</p>
          <p className="mt-0.5 text-ink-700">{PAYMENT_LABELS[order.paymentMethod]}</p>
          <p className="text-ink-500">
            {order.paymentStatus.toLowerCase()} · {rupees(order.total)}
          </p>
        </div>
      </div>

      {order.notes ? <p className="mt-2 text-xs text-ink-500">“{order.notes}”</p> : null}

      {order.runner ? (
        <p className="mt-2 text-xs font-semibold text-forest-600">
          Rider: {order.runner.name}
          {order.runner.phone ? ` · ${order.runner.phone}` : ''}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {action && order.status !== 'READY' ? (
          <button
            type="button"
            className="btn btn-primary px-3 py-2 text-xs"
            onClick={() => onStatus(action.status)}
          >
            {action.label}
          </button>
        ) : null}

        {order.status === 'READY' ? (
          <>
            <select
              className="input max-w-56 py-2 text-xs"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) onAssign(event.target.value);
                event.target.value = '';
              }}
            >
              <option value="">Assign a rider…</option>
              {runners.map((runner) => (
                <option key={runner.id} value={runner.id}>
                  {runner.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary px-3 py-2 text-xs" onClick={() => onStatus('ON_THE_WAY')}>
              Self-delivery pickup
            </button>
          </>
        ) : null}

        {['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].includes(order.status) ? (
          <button type="button" className="btn btn-quiet px-3 py-2 text-xs" onClick={() => onRejectOpen(!rejectOpen)}>
            Reject
          </button>
        ) : null}

        <button type="button" className="btn btn-ghost px-3 py-2 text-xs" onClick={onToggleChat}>
          {chatOpen ? 'Hide chat' : 'Chat'}
        </button>

        <button
          type="button"
          className="btn btn-ghost px-3 py-2 text-xs"
          onClick={() => window.print()}
        >
          Print receipt
        </button>
      </div>

      {rejectOpen ? (
        <div className="mt-3 space-y-2">
          <input
            className="input"
            placeholder="Why is this order being cancelled?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-quiet flex-1"
              onClick={() => {
                onStatus('CANCELLED', { reason: reason || 'Cancelled by the shop' });
                onRejectOpen(false);
              }}
            >
              Cancel order
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onRejectOpen(false)}>
              Keep
            </button>
          </div>
        </div>
      ) : null}

      {chatOpen ? (
        <div className="mt-3">
          <ChatPanel
            order={order}
            messages={messages}
            currentUserId={user?.id ?? ''}
            sending={sending}
            onSend={async (body) => {
              setSending(true);
              try {
                const result = await apiPost<{
                  message: { id: string; senderId: string; senderRole: string; body: string; createdAt: string };
                }>(`/orders/${order.id}/messages`, { body });
                setMessages((current) => [...current, result.message]);
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setSending(false);
              }
            }}
          />
        </div>
      ) : null}

      <Link to={`/orders/${order.id}`} className="mt-3 block text-xs font-semibold text-forest-600">
        Open customer view
      </Link>

      {order.cancelReason ? <ErrorNote>{order.cancelReason}</ErrorNote> : null}
    </article>
  );
}
