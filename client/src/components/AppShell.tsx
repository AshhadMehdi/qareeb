import { useMemo, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cartCount, useCart } from '../store/cart';
import { hasRole, homeForRole, useAuth } from '../store/auth';
import { useLocation } from '../store/location';
import { useNotifications } from '../lib/queries';
import { initials } from '../lib/format';
import { Modal } from './ui';
import LocationPicker from './LocationPicker';
import {
  IconBell,
  IconBike,
  IconCart,
  IconChart,
  IconChat,
  IconGift,
  IconHome,
  IconPin,
  IconReceipt,
  IconSearch,
  IconSettings,
  IconShield,
  IconStore,
  IconTag,
  IconUser,
  IconWallet,
} from './icons';

export type NavItem = { to: string; label: string; icon: ReactNode; badge?: number };

export default function AppShell({ children }: { children: ReactNode }) {
  const user = useAuth((state) => state.user);
  const signOut = useAuth((state) => state.signOut);
  const groups = useCart((state) => state.groups);
  const point = useLocation((state) => state.point);
  const [locationOpen, setLocationOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const isCustomer = hasRole(user, 'CUSTOMER') || !user;
  const notifications = useNotifications();
  const unread = isCustomer ? notifications.data?.unread ?? 0 : 0;
  const count = cartCount(groups);

  const nav = useMemo<NavItem[]>(() => {
    if (hasRole(user, 'MERCHANT')) {
      return [
        { to: '/merchant', label: 'Overview', icon: <IconChart /> },
        { to: '/merchant/orders', label: 'Orders', icon: <IconReceipt /> },
        { to: '/merchant/products', label: 'Products', icon: <IconTag /> },
        { to: '/merchant/shop', label: 'Shop', icon: <IconStore /> },
        { to: '/merchant/riders', label: 'Riders', icon: <IconBike /> },
        { to: '/merchant/payouts', label: 'Payouts', icon: <IconWallet /> },
      ];
    }
    if (hasRole(user, 'RIDER')) {
      return [
        { to: '/rider', label: 'Deliveries', icon: <IconBike /> },
        { to: '/rider/earnings', label: 'Earnings', icon: <IconChart /> },
        { to: '/rider/profile', label: 'Profile', icon: <IconUser /> },
      ];
    }
    if (hasRole(user, 'ADMIN')) {
      return [
        { to: '/admin', label: 'Overview', icon: <IconChart /> },
        { to: '/admin/shops', label: 'Shops', icon: <IconStore /> },
        { to: '/admin/users', label: 'People', icon: <IconUser /> },
        { to: '/admin/orders', label: 'Orders', icon: <IconReceipt /> },
        { to: '/admin/marketing', label: 'Marketing', icon: <IconTag /> },
        { to: '/admin/payouts', label: 'Payouts', icon: <IconWallet /> },
        { to: '/admin/support', label: 'Support', icon: <IconChat /> },
        { to: '/admin/settings', label: 'Platform', icon: <IconSettings /> },
        { to: '/admin/audit', label: 'Audit', icon: <IconShield /> },
      ];
    }
    return [
      { to: '/home', label: 'Shops', icon: <IconHome /> },
      { to: '/search', label: 'Search', icon: <IconSearch /> },
      { to: '/orders', label: 'Orders', icon: <IconReceipt /> },
      { to: '/cart', label: 'Cart', icon: <IconCart />, badge: count },
      { to: '/account', label: 'Account', icon: <IconUser /> },
    ];
  }, [user, count]);

  const mobileNav = nav.slice(0, 5);

  return (
    <div className="min-h-dvh bg-cream-100">
      <header className="sticky top-0 z-40 border-b border-cream-300 bg-cream-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(homeForRole(user?.role))}
            className="flex items-center gap-2 text-left"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-forest-600 text-sm font-bold text-cream-50">
              Q
            </span>
            <span className="text-[17px] font-bold tracking-tight text-forest-800">Qareeb</span>
          </button>

          {isCustomer ? (
            <button
              id="qareeb-location-trigger"
              type="button"
              onClick={() => setLocationOpen(true)}
              aria-label="Change delivery location"
              className="ml-1 flex min-w-0 items-center gap-1.5 rounded-full border border-cream-300 bg-cream-100 px-3 py-1.5 text-left text-xs font-semibold text-forest-700"
            >
              <IconPin className="h-4 w-4 shrink-0 text-forest-500" />
              <span className="truncate">
                {point.source === 'address' ? point.label : point.area ?? point.label}
              </span>
            </button>
          ) : (
            <span className="chip ml-1 border-forest-100 bg-forest-50 text-forest-700">
              {user?.role === 'MERCHANT' ? 'Merchant dashboard' : user?.role === 'RIDER' ? 'Rider app' : 'Admin console'}
            </span>
          )}

          {isCustomer ? (
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="ml-auto hidden items-center gap-2 rounded-full border border-cream-300 bg-cream-100 px-3 py-1.5 text-xs font-medium text-ink-500 sm:flex"
            >
              <IconSearch className="h-4 w-4" />
              Search shops and products
            </button>
          ) : null}

          <div className={`flex items-center gap-2 ${isCustomer ? 'sm:ml-0' : 'ml-auto'}`}>
            {isCustomer ? (
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                className="relative grid h-9 w-9 place-items-center rounded-full border border-cream-300 bg-cream-100 text-forest-700"
                aria-label="Notifications"
              >
                <IconBell className="h-4.5 w-4.5" />
                {unread > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-clay-500 px-1 text-[10px] font-bold text-cream-50">
                    {unread}
                  </span>
                ) : null}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full bg-forest-600 text-xs font-bold text-cream-50"
              aria-label="Account menu"
            >
              {user ? initials(user.name) : <IconUser className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 pb-safe-nav pt-4 lg:pb-10">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to.split('/').length === 2}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-forest-600 text-cream-50'
                      : 'text-forest-700 hover:bg-cream-200'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto rounded-full bg-clay-500 px-1.5 py-0.5 text-[10px] font-bold text-cream-50">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Solid cream tab bar — deliberately not a floating dark dock. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-300 bg-cream-50 pb-safe lg:hidden">
        <div className="mx-auto flex max-w-6xl items-stretch justify-between px-2">
          {mobileNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split('/').length === 2}
              className={({ isActive }) =>
                `relative flex flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-semibold transition ${
                  isActive ? 'text-forest-700' : 'text-ink-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`grid h-8 w-8 place-items-center rounded-xl ${isActive ? 'bg-forest-50' : ''}`}>
                    {item.icon}
                  </span>
                  {item.label}
                  {item.badge ? (
                    <span className="absolute right-3 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-clay-500 px-1 text-[10px] font-bold text-cream-50">
                      {item.badge}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <Modal open={menuOpen} title="Your account" onClose={() => setMenuOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-cream-300 bg-cream-100 p-4">
            <p className="text-sm font-bold text-forest-800">{user?.name}</p>
            <p className="text-xs text-ink-500">{user?.email}</p>
            <p className="mt-1 text-xs font-semibold text-forest-600">
              {user?.role.toLowerCase()} · {isCustomer ? `${user?.walletPoints ?? 0} points` : 'Qareeb partner'}
            </p>
          </div>
          {isCustomer ? (
            <div className="grid grid-cols-2 gap-2">
              <a className="btn btn-ghost" href="/account/addresses">
                Addresses
              </a>
              <a className="btn btn-ghost" href="/account/wallet">
                Points wallet
              </a>
              <a className="btn btn-ghost" href="/account/refer">
                <IconGift className="mr-1.5 inline h-4 w-4" />
                Invite friends
              </a>
              <a className="btn btn-ghost" href="/favorites">
                Favourites
              </a>
              <a className="btn btn-ghost" href="/support">
                Help
              </a>
              <a className="btn btn-ghost" href="/orders">
                Orders
              </a>
            </div>
          ) : null}
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={async () => {
              await signOut();
              setMenuOpen(false);
              navigate('/login');
            }}
          >
            Sign out
          </button>
          <p className="text-center text-[11px] text-ink-500">
            Demo build · {point.area ?? point.label}, Abbottabad
          </p>
        </div>
      </Modal>

      <LocationPicker open={locationOpen} onClose={() => setLocationOpen(false)} />
    </div>
  );
}
