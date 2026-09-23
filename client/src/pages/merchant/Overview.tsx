import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, SectionHeading, Skeleton, StatCard, StatusPill, Tag } from '../../components/ui';
import { useMerchantAnalytics, useMerchantOrders, useMerchantOverview, useUpdateShop } from '../../lib/queries';
import { rupees, tooltipMoney } from '../../lib/format';

export default function MerchantOverview() {
  const shop = useMerchantOverview();
  const analytics = useMerchantAnalytics();
  const orders = useMerchantOrders('ACTIVE');
  const updateShop = useUpdateShop();

  if (shop.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (shop.isError || !shop.data) {
    return (
      <EmptyState
        title="You have not set up a shop yet"
        body="Three short steps: shop details, map location, opening hours. You can sell the moment it is saved."
        action={
          <Link to="/merchant/setup" className="btn btn-primary">
            Start shop setup
          </Link>
        }
      />
    );
  }

  const { shop: record, isOnboarded } = shop.data;
  const pending = orders.data?.counts.pending ?? 0;

  return (
    <div className="space-y-5">
      <header className="card flex flex-wrap items-center gap-4 p-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-600 text-sm font-bold text-cream-50">
          {record.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-forest-800">{record.name}</h1>
            <Tag tone={record.openNow ? 'forest' : 'clay'}>{record.openNow ? 'Accepting orders' : 'Closed'}</Tag>
            {(record.status ?? 'APPROVED') !== 'APPROVED' ? <Tag tone="clay">{(record.status ?? '').toLowerCase()}</Tag> : null}
          </div>
          <p className="mt-0.5 text-xs text-ink-500">
            {record.addressLine} · ★ {record.ratingAvg.toFixed(1)} ({record.ratingCount}) · prep {record.prepTimeMin} min
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost text-xs"
          disabled={updateShop.isPending}
          onClick={async () => {
            try {
              await updateShop.mutateAsync({ isPaused: !record.isPaused });
              toast.success(record.isPaused ? 'Shop is live again' : 'Shop paused — no new orders will arrive');
            } catch (error) {
              toast.error((error as Error).message);
            }
          }}
        >
          {record.isPaused ? 'Resume shop' : 'Pause shop'}
        </button>
      </header>

      {!isOnboarded ? (
        <div className="card border-clay-100 bg-clay-100/50 p-4 text-sm text-clay-600">
          Finish your shop profile so customers can find you.{' '}
          <Link to="/merchant/setup" className="font-semibold underline">
            Complete setup
          </Link>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's sales"
          value={rupees(analytics.data?.today.revenue ?? 0)}
          hint={`${analytics.data?.today.orders ?? 0} orders delivered or in progress`}
          tone="forest"
        />
        <StatCard label="New orders" value={pending} hint="Waiting for you to accept" tone={pending ? 'wheat' : 'default'} />
        <StatCard
          label="14-day revenue"
          value={rupees(analytics.data?.window.revenue ?? 0)}
          hint={`${analytics.data?.window.orders ?? 0} delivered orders`}
        />
        <StatCard
          label="Payout after commission"
          value={rupees(analytics.data?.window.payout ?? 0)}
          hint={`${analytics.data?.settings.commissionPct ?? 0}% platform commission`}
        />
      </section>

      <section className="card p-4">
        <SectionHeading title="Sales trend" subtitle="Last 14 days, excluding cancelled orders" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.data?.daily ?? []}>
              <defs>
                <linearGradient id="qareebRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2f6f56" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2f6f56" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e7dabd" strokeDasharray="4 6" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => value.slice(8)}
                tick={{ fill: '#6b6656', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
                tick={{ fill: '#6b6656', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={38}
              />
              <Tooltip
                formatter={tooltipMoney('Revenue')}
                contentStyle={{ borderRadius: 12, border: '1px solid #e7dabd', background: '#fdfbf6' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#225740" strokeWidth={2} fill="url(#qareebRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <SectionHeading
            title="Live orders"
            subtitle={`${orders.data?.orders.length ?? 0} in the queue`}
            action={
              <Link to="/merchant/orders" className="btn btn-quiet text-xs">
                Open board
              </Link>
            }
          />
          <div className="space-y-2">
            {(orders.data?.orders ?? []).slice(0, 5).map((order) => (
              <Link
                key={order.id}
                to="/merchant/orders"
                className="flex items-center justify-between gap-3 rounded-2xl border border-cream-200 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{order.orderNumber}</p>
                  <p className="text-xs text-ink-500">
                    {order.items.length} items · {order.customer?.name ?? 'Customer'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-ink-900">{rupees(order.total)}</p>
                  <StatusPill status={order.status} />
                </div>
              </Link>
            ))}
            {!orders.data?.orders.length ? (
              <p className="py-6 text-center text-sm text-ink-500">No live orders — the counter is quiet.</p>
            ) : null}
          </div>
        </section>

        <section className="card p-4">
          <SectionHeading title="Top sellers" subtitle="By quantity, last 14 days" />
          <div className="space-y-2">
            {(analytics.data?.topProducts ?? []).map((product) => (
              <div key={product.name} className="flex items-center justify-between text-sm">
                <span className="min-w-0 truncate text-ink-700">{product.name}</span>
                <span className="font-semibold text-forest-700">
                  {product.quantity} × · {rupees(product.revenue)}
                </span>
              </div>
            ))}
            {!analytics.data?.topProducts.length ? (
              <p className="py-6 text-center text-sm text-ink-500">Sales will appear here after your first orders.</p>
            ) : null}
          </div>
        </section>
      </div>

      {analytics.data?.lowStock.length ? (
        <section className="card p-4">
          <SectionHeading
            title="Running low"
            subtitle="Update stock before the next order arrives"
            action={
              <Link to="/merchant/products" className="btn btn-quiet text-xs">
                Manage stock
              </Link>
            }
          />
          <div className="flex flex-wrap gap-2">
            {analytics.data.lowStock.map((product) => (
              <span key={product.id} className="chip border-clay-100 bg-clay-100/60 text-clay-600">
                {product.name} · {product.stock} left
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
