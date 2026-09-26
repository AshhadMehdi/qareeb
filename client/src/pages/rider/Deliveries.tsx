import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState, SectionHeading, Skeleton, StatCard, StatusPill, Tag } from '../../components/ui';
import { useRunnerDeliveries, useRunnerEarnings, useRunnerMutations, useRunnerProfile } from '../../lib/queries';
import { PAYMENT_LABELS, distance, rupees, timeAgo } from '../../lib/format';

export default function RiderDeliveries() {
  const profile = useRunnerProfile();
  const deliveries = useRunnerDeliveries('active');
  const earnings = useRunnerEarnings();
  const { setAvailability, accept } = useRunnerMutations();

  const rider = profile.data?.profile;
  const active = deliveries.data?.active ?? [];
  const available = deliveries.data?.available ?? [];
  const history = deliveries.data?.history ?? [];

  if (profile.isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-5">
      <header className="card flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight text-forest-800">{rider?.name}</h1>
          <p className="text-xs text-ink-500">
            ★ {rider?.ratingAvg.toFixed(1)} ({rider?.ratingCount}) · {rider?.totalDeliveries} deliveries ·{' '}
            {rider?.vehicleType}
          </p>
        </div>
        <button
          type="button"
          className={`btn ${rider?.isAvailable ? 'btn-primary' : 'btn-ghost'}`}
          disabled={setAvailability.isPending}
          onClick={async () => {
            try {
              await setAvailability.mutateAsync({ isAvailable: !rider?.isAvailable });
              toast.success(rider?.isAvailable ? 'You are offline' : 'You are online — orders will come in');
            } catch (error) {
              toast.error((error as Error).message);
            }
          }}
        >
          {rider?.isAvailable ? 'Online — tap to pause' : 'Go online'}
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Today" value={rupees(earnings.data?.today ?? 0)} hint={`${earnings.data?.deliveries.today ?? 0} trips`} tone="forest" />
        <StatCard label="This week" value={rupees(earnings.data?.week ?? 0)} hint={`${earnings.data?.deliveries.week ?? 0} trips`} />
        <StatCard
          label="Cash in hand"
          value={rupees(rider?.cashInHand ?? 0)}
          hint="Collected on cash orders"
          tone={rider && rider.cashInHand > 3000 ? 'wheat' : 'default'}
        />
      </section>

      <section className="card border-forest-100 bg-forest-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label text-forest-600">Rider cockpit</p>
            <h2 className="mt-1 text-lg font-bold text-forest-800">
              {active[0] ? `Next: pick up from ${active[0].shop?.name ?? 'the shop'}.` : available[0] ? `Ready when you are: ${available.length} pickup${available.length === 1 ? '' : 's'} waiting.` : 'Your route is clear.'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-ink-600">
              {active[0] ? `${active[0].deliveryAddress.area ?? 'Abbottabad'} · ${distance(active[0].distanceKm)} · ${active[0].paymentMethod === 'COD' ? `${rupees(active[0].total)} to collect` : 'paid online'}` : 'Stay online to receive nearby assignments, or review your completed trips below.'}
            </p>
          </div>
          {active[0] ? <Link to={`/rider/deliveries/${active[0].id}`} className="btn btn-primary text-xs">Open next delivery</Link> : null}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-cream-50/80 p-3"><p className="label">Active route</p><p className="mt-1 text-sm font-bold text-forest-700">{active.length} {active.length === 1 ? 'trip' : 'trips'}</p></div>
          <div className="rounded-2xl bg-cream-50/80 p-3"><p className="label">Cash safety</p><p className="mt-1 text-sm font-bold text-forest-700">{rupees(rider?.cashInHand ?? 0)} held</p></div>
          <div className="rounded-2xl bg-cream-50/80 p-3"><p className="label">Rating</p><p className="mt-1 text-sm font-bold text-forest-700">★ {rider?.ratingAvg.toFixed(1) ?? '—'}</p></div>
        </div>
      </section>

      <section>
        <SectionHeading title="In progress" subtitle={`${active.length} active ${active.length === 1 ? 'trip' : 'trips'}`} />
        <div className="grid gap-3 lg:grid-cols-2">
          {active.map((order) => (
            <Link key={order.id} to={`/rider/deliveries/${order.id}`} className="card block p-4 transition hover:border-forest-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-forest-800">{order.shop?.name}</p>
                  <p className="text-xs text-ink-500">
                    {order.orderNumber} · {timeAgo(order.createdAt)}
                  </p>
                </div>
                <StatusPill status={order.status} />
              </div>
              <p className="mt-2 text-sm text-ink-700">
                {order.deliveryAddress.label} · {order.deliveryAddress.area ?? 'Abbottabad'}
              </p>
              <p className="text-xs text-ink-500">{order.deliveryAddress.line1}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Tag>{order.items.length} items</Tag>
                <Tag tone={order.paymentMethod === 'COD' ? 'clay' : 'forest'}>
                  {order.paymentMethod === 'COD' ? `${rupees(order.total)} cash` : PAYMENT_LABELS[order.paymentMethod]}
                </Tag>
                <Tag>{distance(order.distanceKm)}</Tag>
              </div>
            </Link>
          ))}
        </div>
        {!deliveries.isLoading && !active.length ? (
          <EmptyState
            compact
            title="No trips right now"
            body="Stay online — shops in your team will assign deliveries as they are packed."
          />
        ) : null}
      </section>

      {available.length ? (
        <section>
          <SectionHeading title="Ready for pickup" subtitle="Orders at your shops that nobody has claimed yet" />
          <div className="grid gap-3 lg:grid-cols-2">
            {available.map((order) => (
              <div key={order.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-forest-800">{order.shop?.name}</p>
                    <p className="text-xs text-ink-500">
                      {order.orderNumber} · {order.deliveryAddress.area ?? 'Abbottabad'}
                    </p>
                  </div>
                  <Tag tone="wheat">Ready</Tag>
                </div>
                <p className="mt-2 text-xs text-ink-500">{order.deliveryAddress.line1}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-primary px-3 py-2 text-xs"
                    disabled={accept.isPending}
                    onClick={async () => {
                      try {
                        await accept.mutateAsync(order.id);
                        toast.success('Delivery accepted');
                      } catch (error) {
                        toast.error((error as Error).message);
                      }
                    }}
                  >
                    Accept delivery
                  </button>
                  <span className="text-xs text-ink-500">
                    {order.paymentMethod === 'COD' ? `${rupees(order.total)} to collect` : 'Paid online'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {history.length ? (
        <section className="card p-4">
          <SectionHeading title="Completed today and earlier" subtitle={`${history.length} finished trips`} />
          <div className="divide-y divide-cream-200">
            {history.slice(0, 8).map((order) => (
              <Link key={order.id} to={`/rider/deliveries/${order.id}`} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{order.shop?.name}</p>
                  <p className="text-xs text-ink-500">
                    {order.orderNumber} · {order.deliveredAt ? timeAgo(order.deliveredAt) : 'delivered'}
                  </p>
                </div>
                <span className="text-sm font-bold text-forest-700">
                  {rupees(order.deliveryFee + order.tip)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
