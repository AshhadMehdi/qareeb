import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Field, SectionHeading, Skeleton, Tag } from '../../components/ui';
import { apiPatch } from '../../lib/api';
import { useRunnerProfile } from '../../lib/queries';
import { initials, rupees } from '../../lib/format';
import { useAuth } from '../../store/auth';

export default function RiderProfile() {
  const profile = useRunnerProfile();
  const user = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const signOut = useAuth((state) => state.signOut);
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [busy, setBusy] = useState(false);

  if (profile.isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center gap-4 p-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-forest-600 text-base font-bold text-cream-50">
          {user ? initials(user.name) : 'R'}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight text-forest-800">{profile.data?.profile.name}</h1>
          <p className="text-xs text-ink-500">{profile.data?.profile.email}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Tag tone={profile.data?.profile.isAvailable ? 'forest' : 'cream'}>
              {profile.data?.profile.isAvailable ? 'Online' : 'Offline'}
            </Tag>
            <Tag>{profile.data?.profile.vehicleType}</Tag>
            <Tag>★ {profile.data?.profile.ratingAvg.toFixed(1)}</Tag>
          </div>
        </div>
        <div className="text-right">
          <p className="label">Cash in hand</p>
          <p className="text-lg font-bold text-forest-800">{rupees(profile.data?.profile.cashInHand ?? 0)}</p>
        </div>
      </section>

      <section className="card p-4">
        <SectionHeading title="Your details" subtitle="Shops and customers see your name and number" />
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              const data = await apiPatch<{ user: NonNullable<typeof user> }>('/users/me', form);
              if (data.user) setUser(data.user);
              toast.success('Profile updated');
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Name">
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Mobile">
            <input
              className="input"
              value={form.phone ?? ''}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="+92 300 1234567"
            />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Save details
            </button>
          </div>
        </form>
      </section>

      <section className="card p-4">
        <SectionHeading title="Vehicle" subtitle="Used when shops auto-assign the nearest rider" />
        <div className="flex flex-wrap gap-2">
          {(['bike', 'bicycle', 'car', 'van'] as const).map((vehicle) => (
            <button
              key={vehicle}
              type="button"
              className={`chip ${profile.data?.profile.vehicleType === vehicle ? 'chip-active' : ''}`}
              onClick={async () => {
                try {
                  await apiPatch('/runner/me', { vehicleType: vehicle });
                  toast.success(`Vehicle set to ${vehicle}`);
                  void profile.refetch();
                } catch (error) {
                  toast.error((error as Error).message);
                }
              }}
            >
              {vehicle}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <SectionHeading title="Session" />
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
          Keep this tab open while riding so customers can follow your position in real time.
        </p>
      </section>
    </div>
  );
}
