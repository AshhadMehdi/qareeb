import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState, Field, SectionHeading, Skeleton, Tag } from '../../components/ui';
import { apiDelete, apiPost } from '../../lib/api';
import { useMerchantRunners, useMerchantOverview } from '../../lib/queries';

export default function MerchantRiders() {
  const shop = useMerchantOverview();
  const runners = useMerchantRunners();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (shop.isLoading || runners.isLoading) return <Skeleton className="h-40 w-full" />;
  if (shop.isError) {
    return <EmptyState title="Set up your shop first" body="Riders are attached to a shop." />;
  }

  const team = runners.data?.team ?? [];
  const nearby = runners.data?.nearby ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Riders</h1>
        <p className="text-sm text-ink-500">
          {team.length} on your team · {nearby.filter((runner) => runner.isAvailable).length} platform riders online
        </p>
      </div>

      <section className="card p-4">
        <SectionHeading title="Add a rider by email" subtitle="They sign in with the demo password or their own" />
        <form
          className="grid gap-3 sm:grid-cols-[2fr_1.4fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await apiPost('/merchant/runners', { email, name: name || undefined });
              toast.success('Rider linked to your shop');
              setEmail('');
              setName('');
              void runners.refetch();
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Rider email">
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="rider5@demo.com"
            />
          </Field>
          <Field label="Name" hint="Optional, used if the account is new">
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              Add rider
            </button>
          </div>
        </form>
      </section>

      <section className="card p-4">
        <SectionHeading title="Your team" subtitle="Riders who see your ready orders first" />
        <div className="space-y-2">
          {team.map((runner) => (
            <div key={runner.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-cream-200 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-forest-800">{runner.name}</p>
                <p className="text-xs text-ink-500">
                  {runner.email} · ★ {runner.ratingAvg.toFixed(1)} · {runner.totalDeliveries} deliveries
                </p>
              </div>
              <Tag tone={runner.isAvailable ? 'forest' : 'cream'}>
                {runner.isAvailable ? 'Online' : 'Offline'}
              </Tag>
              <Tag>{runner.activeOrders ?? 0} active</Tag>
              <Tag tone={runner.cashInHand > 0 ? 'clay' : 'cream'}>Cash {runner.cashInHand}</Tag>
              <button
                type="button"
                className="btn btn-quiet px-3 py-1.5 text-xs"
                onClick={async () => {
                  try {
                    await apiDelete(`/merchant/runners/${runner.id}`);
                    toast.success('Removed from your team');
                    void runners.refetch();
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                Remove
              </button>
            </div>
          ))}
          {!team.length ? (
            <EmptyState compact title="No riders on your team" body="Add one above, or use auto-assign per order." />
          ) : null}
        </div>
      </section>

      <section className="card p-4">
        <SectionHeading title="Platform riders nearby" subtitle="Available to any shop when they are online" />
        <div className="space-y-2">
          {nearby.slice(0, 8).map((runner) => (
            <div key={runner.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-cream-200 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">{runner.name}</p>
                <p className="text-xs text-ink-500">
                  {runner.distanceKm != null ? `${runner.distanceKm} km away` : 'location unknown'} ·{' '}
                  {runner.vehicleType} · {runner.activeOrders ?? 0} active
                </p>
              </div>
              <Tag tone={runner.isAvailable ? 'forest' : 'cream'}>{runner.isAvailable ? 'Online' : 'Offline'}</Tag>
              <button
                type="button"
                className="btn btn-ghost px-3 py-1.5 text-xs"
                onClick={async () => {
                  try {
                    await apiPost('/merchant/runners', { email: runner.email });
                    toast.success(`${runner.name} added to your team`);
                    void runners.refetch();
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                Add to team
              </button>
            </div>
          ))}
          {!nearby.length ? <p className="text-sm text-ink-500">Every nearby rider is already on your team.</p> : null}
        </div>
      </section>

      <p className="text-xs text-ink-500">
        Riders are dispatched from <Link to="/merchant/orders" className="font-semibold text-forest-600">the orders board</Link>
        : choose “Auto-assign nearest rider” or pick someone specific.
      </p>
    </div>
  );
}
