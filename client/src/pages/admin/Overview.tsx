import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import MapView from '../../components/MapView';
import { SectionHeading, Skeleton, StatCard, Tag } from '../../components/ui';
import { useAdminShops, useAdminStats } from '../../lib/queries';
import { rupees, tooltipMoney } from '../../lib/format';

export default function AdminOverview() {
  const stats = useAdminStats();
  const shops = useAdminShops('PENDING');

  if (stats.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const totals = stats.data?.totals;
  const counts = stats.data?.counts;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Platform overview</h1>
        <p className="text-sm text-ink-500">Abbottabad · last 14 days · updates every 30 seconds</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="GMV delivered" value={rupees(totals?.gmv ?? 0)} hint={`${totals?.delivered ?? 0} completed orders`} tone="forest" />
        <StatCard label="Platform revenue" value={rupees((totals?.commission ?? 0) + (totals?.serviceFees ?? 0))} hint="Commission + service fees" />
        <StatCard label="Average basket" value={rupees(totals?.averageOrderValue ?? 0)} hint={`${totals?.orders ?? 0} orders in the window`} />
        <StatCard
          label="Riders online"
          value={`${counts?.ridersOnline ?? 0} / ${counts?.riders ?? 0}`}
          hint="Available in the last 10 minutes"
          tone="wheat"
        />
      </section>

      <section className="card p-4">
        <SectionHeading title="Order volume" subtitle="GMV per day, cancelled orders excluded" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.data?.daily ?? []}>
              <defs>
                <linearGradient id="qareebGmv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#225740" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#225740" stopOpacity={0} />
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
                width={40}
              />
              <Tooltip
                formatter={tooltipMoney('GMV')}
                contentStyle={{ borderRadius: 12, border: '1px solid #e7dabd', background: '#fdfbf6' }}
              />
              <Area type="monotone" dataKey="gmv" stroke="#102e22" strokeWidth={2} fill="url(#qareebGmv)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="card p-4">
          <SectionHeading title="Live map" subtitle="Shops and riders across the city" />
          <MapView
            center={[34.1688, 73.2215]}
            zoom={13}
            height="20rem"
            markers={[
              ...(stats.data?.live.shops ?? []).map((shop) => ({
                id: shop.id,
                lat: shop.lat,
                lng: shop.lng,
                label: shop.name,
                kind: 'shop' as const,
              })),
              ...(stats.data?.live.riders ?? [])
                .filter((rider) => rider.lat != null && rider.lng != null)
                .map((rider) => ({
                  id: rider.id,
                  lat: rider.lat!,
                  lng: rider.lng!,
                  label: rider.name,
                  kind: 'rider' as const,
                })),
            ]}
          />
        </div>

        <div className="space-y-4">
          <section className="card p-4">
            <SectionHeading title="People" subtitle="Accounts by role" />
            <div className="space-y-1.5">
              {(counts?.users ?? []).map((entry) => (
                <div key={entry.role} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-ink-700">{entry.role.toLowerCase()}s</span>
                  <span className="font-bold text-forest-700">{entry.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-4">
            <SectionHeading
              title="Shops awaiting approval"
              subtitle={`${counts?.pendingShops ?? 0} pending · ${counts?.approvedShops ?? 0} live`}
              action={
                <Link to="/admin/shops" className="btn btn-quiet text-xs">
                  Review
                </Link>
              }
            />
            <div className="space-y-2">
              {(shops.data?.shops ?? []).slice(0, 4).map((shop) => (
                <div key={shop.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-ink-700">{shop.name}</span>
                  <Tag tone="clay">{shop.category}</Tag>
                </div>
              ))}
              {!shops.data?.shops.length ? (
                <p className="text-sm text-ink-500">Nothing waiting — every shop is reviewed.</p>
              ) : null}
            </div>
          </section>

          <section className="card p-4">
            <SectionHeading title="Rider positions" subtitle="Latest GPS pings" />
            <div className="space-y-1.5">
              {(stats.data?.live.riders ?? []).slice(0, 6).map((rider) => (
                <div key={rider.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{rider.name}</span>
                  <span className="text-xs text-ink-500">
                    {rider.isAvailable ? 'online' : 'offline'}
                    {rider.lat != null ? ` · ${rider.lat.toFixed(3)}, ${rider.lng?.toFixed(3)}` : ' · no fix'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
