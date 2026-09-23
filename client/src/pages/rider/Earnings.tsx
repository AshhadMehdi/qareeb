import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, SectionHeading, Skeleton, StatCard } from '../../components/ui';
import { useRunnerEarnings, useRunnerProfile } from '../../lib/queries';
import { dayLabel, rupees, tooltipMoney } from '../../lib/format';

export default function RiderEarnings() {
  const earnings = useRunnerEarnings();
  const profile = useRunnerProfile();

  if (earnings.isLoading) return <Skeleton className="h-40 w-full" />;

  const data = earnings.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Earnings</h1>
        <p className="text-sm text-ink-500">
          You keep the delivery fee and every tip. {profile.data?.profile.cashInHand ? `${rupees(profile.data.profile.cashInHand)} cash is with you.` : ''}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Today" value={rupees(data?.today ?? 0)} hint={`${data?.deliveries.today ?? 0} trips`} tone="forest" />
        <StatCard label="Last 7 days" value={rupees(data?.week ?? 0)} hint={`${data?.deliveries.week ?? 0} trips`} />
        <StatCard label="Last 30 days" value={rupees(data?.month ?? 0)} hint={`${data?.deliveries.month ?? 0} trips`} />
      </section>

      <section className="card p-4">
        <SectionHeading title="Daily earnings" subtitle="Delivery fees plus tips" />
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.daily ?? []}>
              <CartesianGrid stroke="#e7dabd" strokeDasharray="4 6" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => value.slice(8)}
                tick={{ fill: '#6b6656', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fill: '#6b6656', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={tooltipMoney('Earned')}
                contentStyle={{ borderRadius: 12, border: '1px solid #e7dabd', background: '#fdfbf6' }}
              />
              <Bar dataKey="amount" fill="#2f6f56" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card p-4">
        <SectionHeading title="Recent trips" subtitle={`${data?.tips ? rupees(data.tips) : 'No'} tips in the last 30 days`} />
        <div className="divide-y divide-cream-200">
          {(data?.recent ?? []).map((trip) => (
            <div key={trip.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-semibold text-ink-900">{trip.orderNumber}</p>
                <p className="text-xs text-ink-500">{trip.deliveredAt ? dayLabel(trip.deliveredAt) : 'in progress'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-forest-700">{rupees(trip.earned)}</p>
                {trip.tip ? <p className="text-xs text-ink-500">includes {rupees(trip.tip)} tip</p> : null}
              </div>
            </div>
          ))}
        </div>
        {!data?.recent.length ? (
          <EmptyState compact title="No completed trips yet" body="Deliver your first order to start earning." />
        ) : null}
      </section>
    </div>
  );
}
