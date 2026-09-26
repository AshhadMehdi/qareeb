import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, Skeleton, StatusPill, Tag } from '../../components/ui';
import { useAdminOrders } from '../../lib/queries';
import { apiPost } from '../../lib/api';
import { PAYMENT_LABELS, clockTime, rupees } from '../../lib/format';

const FILTERS = ['ALL', 'PENDING', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'];

export default function AdminOrders() {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const orders = useAdminOrders(filter);
  const [busy, setBusy] = useState<string | null>(null);

  const list = (orders.data?.orders ?? []).filter((order) =>
    search ? order.orderNumber.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-forest-800">Orders</h1>
          <p className="text-sm text-ink-500">{list.length} shown · intervene on any stuck order</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input max-w-44"
            placeholder="Order number"
            value={search}
            onChange={(event) => setSearch(event.target.value.toUpperCase())}
          />
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip ${filter === option ? 'chip-active' : ''}`}
              onClick={() => setFilter(option)}
            >
              {option.toLowerCase().replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {orders.isLoading ? <Skeleton className="h-40 w-full" /> : null}

      <section className="card overflow-hidden">
        <div className="hidden grid-cols-[1.2fr_1.6fr_1.4fr_0.9fr_1.3fr] gap-3 border-b border-cream-200 bg-cream-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-500 lg:grid">
          <span>Order</span>
          <span>Shop</span>
          <span>Customer</span>
          <span>Total</span>
          <span className="text-right">Status</span>
        </div>
        <div className="divide-y divide-cream-200">
          {list.map((order) => (
            <div key={order.id} className="grid gap-2 px-4 py-3 lg:grid-cols-[1.2fr_1.6fr_1.4fr_0.9fr_1.3fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold text-ink-900">{order.orderNumber}</p>
                <p className="text-xs text-ink-500">
                  {clockTime(order.createdAt)} · {order.items.length} items
                </p>
              </div>
              <p className="truncate text-sm text-ink-700">{order.shopName}</p>
              <div>
                <p className="truncate text-sm text-ink-700">{order.customerName}</p>
                <p className="text-xs text-ink-500">{order.deliveryAddress.area}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-ink-900">{rupees(order.total)}</p>
                <p className="text-xs text-ink-500">{PAYMENT_LABELS[order.paymentMethod]}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <StatusPill status={order.status} />
                {!['DELIVERED', 'CANCELLED'].includes(order.status) ? (
                  <button
                    type="button"
                    className="btn btn-quiet px-3 py-1.5 text-xs"
                    disabled={busy === order.id}
                    onClick={async () => {
                      const reason = window.prompt('Reason for cancelling this order?', 'Cancelled by platform support');
                      if (reason === null) return;
                      setBusy(order.id);
                      try {
                        await apiPost(`/merchant/orders/${order.id}/status?shopId=${order.shopId}`, {
                          status: 'CANCELLED',
                          reason,
                        });
                        toast.success('Order cancelled and refunded where applicable');
                        void orders.refetch();
                      } catch (error) {
                        toast.error((error as Error).message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    Intervene
                  </button>
                ) : (
                  <Tag>{order.paymentStatus.toLowerCase()}</Tag>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {!orders.isLoading && !list.length ? (
        <EmptyState title="No orders in this view" body="Try another status filter." />
      ) : null}
    </div>
  );
}
