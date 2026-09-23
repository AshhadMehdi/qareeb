import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState, Skeleton, StatusPill } from '../../components/ui';
import { useOrders, useReviewOrder } from '../../lib/queries';
import { apiPost } from '../../lib/api';
import { PAYMENT_LABELS, dayLabel, rupees, timeAgo } from '../../lib/format';
import type { Order } from '../../lib/types';

const FILTERS = [
  { key: 'ACTIVE', label: 'In progress' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'ALL', label: 'Everything' },
];

export default function Orders() {
  const [filter, setFilter] = useState('ALL');
  const orders = useOrders(filter);
  const list = orders.data?.orders ?? [];
  const active = orders.data?.active ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-forest-800">Your orders</h1>
          <p className="text-sm text-ink-500">
            {active ? `${active} in progress right now` : 'Nothing in progress — the kitchen is calm.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`chip ${filter === option.key ? 'chip-active' : ''}`}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {orders.isLoading ? <Skeleton className="h-24 w-full" /> : null}

      {!orders.isLoading && !list.length ? (
        <EmptyState
          title="No orders here yet"
          body="When you order, this is where the tracking, receipts and reorder buttons live."
          action={
            <Link to="/home" className="btn btn-primary">
              Browse shops
            </Link>
          }
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((order) => (
          <OrderCard key={order.id} order={order} onChanged={() => void orders.refetch()} />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const review = useReviewOrder();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/orders/${order.id}`} className="block truncate text-sm font-bold text-forest-800 hover:underline">
            {order.shop?.name ?? 'Shop'}
          </Link>
          <p className="text-xs text-ink-500">
            {order.orderNumber} · {dayLabel(order.createdAt)} · {timeAgo(order.createdAt)}
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>

      <ul className="mt-3 space-y-1 text-xs text-ink-700">
        {order.items.slice(0, 3).map((item) => (
          <li key={item.id} className="truncate">
            {item.quantity} × {item.name}
          </li>
        ))}
        {order.items.length > 3 ? <li className="text-ink-500">+{order.items.length - 3} more items</li> : null}
      </ul>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-xs text-ink-500">
          {PAYMENT_LABELS[order.paymentMethod]} · {order.paymentStatus.toLowerCase()}
        </span>
        <span className="font-bold text-ink-900">{rupees(order.total)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={`/orders/${order.id}`} className="btn btn-primary px-3 py-2 text-xs">
          {['DELIVERED', 'CANCELLED'].includes(order.status) ? 'View receipt' : 'Track order'}
        </Link>
        <button
          type="button"
          className="btn btn-ghost px-3 py-2 text-xs"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await apiPost<{ lines: { productId: string; quantity: number }[]; shopId: string }>(
                `/orders/${order.id}/reorder`,
              );
              toast.success(`Reorder ready: ${result.lines.length} lines — open the shop to confirm`);
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Reorder
        </button>
      </div>

      {order.status === 'DELIVERED' && !order.hasReview ? (
        <div className="mt-3 rounded-2xl border border-cream-200 bg-cream-100 p-3">
          <p className="text-xs font-semibold text-forest-800">Rate this order</p>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} stars`}
                className={`text-lg ${value <= rating ? 'text-wheat-500' : 'text-cream-400'}`}
                onClick={() => setRating(value)}
              >
                ★
              </button>
            ))}
          </div>
          <input
            className="input mt-2"
            placeholder="How was the packing and the rider?"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={400}
          />
          <button
            type="button"
            className="btn btn-primary mt-2 w-full py-2 text-xs"
            disabled={review.isPending}
            onClick={async () => {
              try {
                await review.mutateAsync({ id: order.id, shopRating: rating, runnerRating: rating, comment });
                toast.success('Thanks — your rating helps other neighbours');
                onChanged();
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            Submit rating
          </button>
        </div>
      ) : null}

      {order.hasReview ? (
        <p className="mt-3 text-xs text-forest-600">You rated this order — shukriya.</p>
      ) : null}
    </article>
  );
}
