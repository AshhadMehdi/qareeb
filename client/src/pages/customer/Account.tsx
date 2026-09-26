import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Field, SectionHeading, Skeleton, StatCard } from '../../components/ui';
import { apiPatch } from '../../lib/api';
import { useProfile, useWallet } from '../../lib/queries';
import { initials, rupees } from '../../lib/format';
import { useAuth } from '../../store/auth';
import { useLocation } from '../../store/location';

export default function Account() {
  const user = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const signOut = useAuth((state) => state.signOut);
  const profile = useProfile();
  const wallet = useWallet();
  const { point } = useLocation();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center gap-4 p-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-forest-600 text-base font-bold text-cream-50">
          {user ? initials(user.name) : 'Q'}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight text-forest-800">{user?.name}</h1>
          <p className="text-sm text-ink-500">{user?.email}</p>
          <p className="mt-0.5 text-xs text-ink-500">
            Delivering to {point.label}
            {point.area ? `, ${point.area}` : ''} · {point.source === 'gps' ? 'GPS pinned' : 'saved location'}
          </p>
        </div>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setEditing((open) => !open)}>
          {editing ? 'Close' : 'Edit profile'}
        </button>
      </section>

      {editing ? (
        <section className="card p-4">
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const data = await apiPatch<{ user: typeof user }>('/users/me', form);
                if (data.user) setUser(data.user);
                toast.success('Profile updated');
                setEditing(false);
                void profile.refetch();
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            <Field label="Name">
              <input
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Mobile" hint="The rider calls this number on arrival">
              <input
                className="input"
                value={form.phone ?? ''}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </Field>
            <button type="submit" className="btn btn-primary w-full">
              Save changes
            </button>
          </form>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {profile.isLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <StatCard label="Orders placed" value={profile.data?.stats.total ?? 0} />
            <StatCard label="Delivered" value={profile.data?.stats.delivered ?? 0} tone="forest" />
            <StatCard label="Spent" value={rupees(profile.data?.stats.spent ?? 0)} />
          </>
        )}
      </section>

      <section className="card p-4">
        <SectionHeading
          title="Points wallet"
          subtitle={`${wallet.data?.points ?? user?.walletPoints ?? 0} points · worth ${
            rupees(wallet.data?.valuePkr ?? 0)
          } off your next order`}
          action={
            <Link to="/account/wallet" className="btn btn-quiet text-xs">
              Open wallet
            </Link>
          }
        />
        <div className="space-y-1.5">
          {(wallet.data?.history ?? []).slice(0, 4).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-sm">
              <span className="text-ink-700">{entry.orderNumber}</span>
              <span className="font-semibold text-forest-600">
                {entry.pointsEarned ? `+${entry.pointsEarned}` : `−${entry.pointsRedeemed}`}
              </span>
            </div>
          ))}
          {!wallet.data?.history.length ? (
            <p className="text-sm text-ink-500">
              You earn points on every delivered order — 2 points per Rs 100.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {[
          { to: '/account/addresses', title: 'Addresses', body: `${profile.data?.addresses.length ?? 0} saved with map pins` },
          { to: '/favorites', title: 'Favourites', body: `${profile.data?.favorites.length ?? 0} shops saved` },
          { to: '/orders', title: 'Order history', body: 'Receipts, tracking and reorders' },
          { to: '/notifications', title: 'Notifications', body: 'Order updates and offers' },
        ].map((entry) => (
          <Link key={entry.to} to={entry.to} className="card p-4 transition hover:border-forest-200">
            <p className="text-sm font-bold text-forest-800">{entry.title}</p>
            <p className="mt-0.5 text-xs text-ink-500">{entry.body}</p>
          </Link>
        ))}
      </section>

      <section className="card space-y-3 p-4">
        <SectionHeading title="Session" subtitle="You can sign out on this device only" />
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
        >
          Sign out
        </button>
        <p className="text-xs text-ink-500">
          Demo build for Abbottabad. Cash on delivery, JazzCash and Easypaisa run in sandbox mode.
        </p>
      </section>
    </div>
  );
}
