import { useState } from 'react';
import { Link, useLocation as useRouterLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ErrorNote, Field, Spinner } from '../components/ui';
import { useConfig } from '../lib/queries';
import { homeForRole, useAuth } from '../store/auth';

const DEMO_ACCOUNTS = [
  { email: 'ali@demo.com', label: 'Customer', detail: 'Ali Raza · live order in progress' },
  { email: 'madina@demo.com', label: 'Merchant', detail: 'Al-Madina Karyana Store' },
  { email: 'rider1@demo.com', label: 'Rider', detail: 'Bilal Khan · mid-delivery' },
  { email: 'admin@qareeb.app', label: 'Admin', detail: 'Platform console' },
];

export default function Login() {
  const signIn = useAuth((state) => state.signIn);
  const demoSignIn = useAuth((state) => state.demoSignIn);
  const status = useAuth((state) => state.status);
  const authError = useAuth((state) => state.error);
  const clearError = useAuth((state) => state.clearError);
  const config = useConfig();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const [email, setEmail] = useState('ali@demo.com');
  const [password, setPassword] = useState(config.data?.demoPassword ?? 'password123');
  const [busy, setBusy] = useState<string | null>(null);

  const from = (routerLocation.state as { from?: string } | null)?.from;

  const finish = (role: string) => {
    navigate(from ?? homeForRole(role as never), { replace: true });
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="hidden flex-col justify-between bg-forest-700 p-10 text-cream-100 lg:flex">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-cream-50 text-sm font-bold text-forest-700">
            Q
          </span>
          <span className="text-lg font-bold tracking-tight text-cream-50">Qareeb</span>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-4xl leading-tight text-cream-50">
            The karyana, the bakery and the pharmacy — on one scooter.
          </h1>
          <p className="mt-4 text-sm text-cream-200">
            Qareeb delivers across Abbottabad with live rider tracking, multi-shop carts and payment by cash,
            JazzCash, Easypaisa or loyalty points.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 text-xs">
            {[
              ['10 shops', 'seeded across Mandian, Supply Bazaar and Kakul Road'],
              ['4 apps', 'customer, merchant, rider and admin in one codebase'],
              ['5-second feed', 'rider positions stream to the tracking map'],
              ['PKR pricing', 'realistic karyana, sabzi and meat catalogues'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-forest-600 bg-forest-600/40 p-3">
                <p className="font-bold text-cream-50">{title}</p>
                <p className="mt-1 text-cream-200">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-cream-200">Abbottabad, Khyber Pakhtunkhwa · {config.data?.announcement}</p>
      </section>

      <section className="flex items-center justify-center bg-cream-100 px-5 py-10">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-600 text-sm font-bold text-cream-50">
              Q
            </span>
          </div>

          <div>
            <h2 className="font-display text-3xl text-forest-800">Welcome back</h2>
            <p className="mt-1 text-sm text-ink-500">
              {config.data?.city ?? 'Abbottabad'} · sign in or use a demo account below.
            </p>
          </div>

          {config.data?.demoPassword ? (
            <div className="card p-4">
              <p className="label">Demo accounts</p>
              <p className="mt-1 text-xs text-ink-500">
                Password for every demo login is <span className="font-bold text-forest-700">{config.data.demoPassword}</span>
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    disabled={busy === account.email}
                    onClick={async () => {
                      setBusy(account.email);
                      clearError();
                      try {
                        const user = await demoSignIn(account.email);
                        toast.success(`Signed in as ${user.name}`);
                        finish(user.role);
                      } catch (caught) {
                        toast.error((caught as Error).message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                    className="rounded-2xl border border-cream-300 bg-cream-50 p-3 text-left transition hover:border-forest-200"
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-sm font-bold text-forest-800">{account.label}</span>
                      {busy === account.email ? <Spinner className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-500">{account.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <form
            className="card space-y-4 p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              clearError();
              try {
                const user = await signIn(email, password);
                toast.success(`Welcome, ${user.name.split(' ')[0]}`);
                finish(user.role);
              } catch (caught) {
                toast.error((caught as Error).message);
              }
            }}
          >
            <Field label="Email">
              <input
                className="input"
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                className="input"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>

            {authError ? <ErrorNote>{authError}</ErrorNote> : null}

            <button type="submit" className="btn btn-primary w-full py-3" disabled={status === 'loading'}>
              {status === 'loading' ? <Spinner /> : 'Sign in'}
            </button>

            <p className="text-center text-xs text-ink-500">
              New to Qareeb?{' '}
              <Link to="/signup" className="font-semibold text-forest-600">
                Create an account
              </Link>
            </p>
          </form>

          <p className="text-center text-xs text-ink-500">
            <Link to="/home" className="font-semibold text-forest-600">
              Browse shops without signing in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
