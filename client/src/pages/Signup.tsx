import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ErrorNote, Field, Spinner } from '../components/ui';
import { homeForRole, useAuth } from '../store/auth';

const ROLES = [
  { value: 'CUSTOMER', label: 'Customer', detail: 'Order from shops around you' },
  { value: 'MERCHANT', label: 'Shop owner', detail: 'Sell on Qareeb and manage orders' },
  { value: 'RIDER', label: 'Rider', detail: 'Deliver orders and earn per trip' },
] as const;

export default function Signup() {
  const register = useAuth((state) => state.register);
  const status = useAuth((state) => state.status);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'CUSTOMER' as (typeof ROLES)[number]['value'],
    referralCode: params.get('ref')?.toUpperCase() ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <div className="card space-y-4 p-5">
        <div>
          <h1 className="font-display text-3xl text-forest-800">Join Qareeb</h1>
          <p className="mt-1 text-sm text-ink-500">Abbottabad's neighbourhood delivery service.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {ROLES.map((role) => (
            <button
              key={role.value}
              type="button"
              onClick={() => setForm({ ...form, role: role.value })}
              className={`rounded-2xl border p-3 text-left text-xs ${
                form.role === role.value ? 'border-forest-400 bg-forest-50' : 'border-cream-300 bg-cream-50'
              }`}
            >
              <span className="block text-sm font-bold text-forest-800">{role.label}</span>
              <span className="mt-0.5 block text-ink-500">{role.detail}</span>
            </button>
          ))}
        </div>

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            try {
              const user = await register({
                name: form.name,
                email: form.email,
                phone: form.phone || undefined,
                password: form.password,
                role: form.role,
                referralCode: form.referralCode || undefined,
              });
              toast.success(`Welcome to Qareeb, ${user.name.split(' ')[0]}`);
              navigate(homeForRole(user.role), { replace: true });
            } catch (caught) {
              setError((caught as Error).message);
            }
          }}
        >
          <Field label="Full name">
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ali Raza"
              required
            />
          </Field>
          <Field label="Email">
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="you@example.com"
              required
            />
          </Field>
          <Field label="Mobile number" hint="Used by the rider to reach you">
            <input
              className="input"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="+92 300 1234567"
            />
          </Field>
          <Field label="Password" hint="At least 8 characters">
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
              minLength={8}
            />
          </Field>

          {form.role === 'CUSTOMER' ? (
            <Field label="Invite code" hint="Optional — you and your friend both get points">
              <input
                className="input uppercase"
                value={form.referralCode}
                onChange={(event) => setForm({ ...form, referralCode: event.target.value.toUpperCase() })}
                placeholder="ALI-K3X9"
              />
            </Field>
          ) : null}

          {error ? <ErrorNote>{error}</ErrorNote> : null}

          <button type="submit" className="btn btn-primary w-full py-3" disabled={status === 'loading'}>
            {status === 'loading' ? <Spinner /> : 'Create account'}
          </button>
        </form>

        <p className="text-center text-xs text-ink-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-forest-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
