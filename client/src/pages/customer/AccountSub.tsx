import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import MapView from '../../components/MapView';
import { AddressForm } from '../../components/LocationPicker';
import { EmptyState, SectionHeading, Skeleton, Tag } from '../../components/ui';
import { apiDelete, apiPost } from '../../lib/api';
import { useNotifications, useProfile, useWallet } from '../../lib/queries';
import { timeAgo, rupees, dayLabel } from '../../lib/format';
import { useLocation } from '../../store/location';
import type { Address } from '../../lib/types';

export function Addresses() {
  const profile = useProfile();
  const { point, setFromAddress, useGps } = useLocation();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  const addresses = profile.data?.addresses ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-forest-800">Addresses</h1>
          <p className="text-sm text-ink-500">Saved places with a map pin, so riders find your gate.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={async () => {
              const next = await useGps();
              if (next) toast.success('Using your current location');
            }}
          >
            Use GPS
          </button>
          <button type="button" className="btn btn-primary text-xs" onClick={() => setAdding((open) => !open)}>
            {adding ? 'Close' : 'Add address'}
          </button>
        </div>
      </div>

      {adding ? (
        <AddressForm
          defaultCenter={{ lat: point.lat, lng: point.lng }}
          onDone={() => {
            setAdding(false);
            void profile.refetch();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      {profile.isLoading ? <Skeleton className="h-24 w-full" /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {addresses.map((address) => (
          <div key={address.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-forest-800">{address.label}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {address.line1}
                  {address.area ? `, ${address.area}` : ''}, {address.city}
                </p>
                {address.instructions ? (
                  <p className="mt-1 text-xs text-ink-500">“{address.instructions}”</p>
                ) : null}
              </div>
              {address.isDefault ? <Tag tone="forest">Default</Tag> : null}
            </div>
            <div className="mt-3">
              <MapView
                center={[address.lat, address.lng]}
                zoom={15}
                height="8.5rem"
                markers={[{ id: address.id, lat: address.lat, lng: address.lng, label: address.label, kind: 'home' }]}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost px-3 py-2 text-xs"
                onClick={() => {
                  setFromAddress(address);
                  toast.success(`Delivering to ${address.label}`);
                }}
              >
                Deliver here
              </button>
              <button type="button" className="btn btn-quiet px-3 py-2 text-xs" onClick={() => setEditing(address)}>
                Edit
              </button>
              <button
                type="button"
                className="btn btn-quiet px-3 py-2 text-xs"
                onClick={async () => {
                  try {
                    await apiDelete(`/users/me/addresses/${address.id}`);
                    toast.success('Address removed');
                    void profile.refetch();
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <AddressForm
          initial={editing}
          defaultCenter={{ lat: editing.lat, lng: editing.lng }}
          onDone={() => {
            setEditing(null);
            void profile.refetch();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {!profile.isLoading && !addresses.length ? (
        <EmptyState title="No saved addresses" body="Add your home and office so checkout takes one tap." />
      ) : null}
    </div>
  );
}

export function Wallet() {
  const wallet = useWallet();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Points wallet</h1>
        <p className="text-sm text-ink-500">Earn 2 points per Rs 100 delivered. 1 point = Re 1 off.</p>
      </div>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="label">Balance</p>
          <p className="mt-1 text-3xl font-bold text-forest-800">{wallet.data?.points ?? 0}</p>
          <p className="text-xs text-ink-500">Worth {rupees(wallet.data?.valuePkr ?? 0)} at checkout</p>
        </div>
        <Link to="/home" className="btn btn-primary">
          Spend points on an order
        </Link>
      </section>

      <section className="card p-4">
        <SectionHeading title="Recent activity" subtitle="Points earned and redeemed" />
        <div className="divide-y divide-cream-200">
          {(wallet.data?.history ?? []).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <p className="font-semibold text-ink-900">{entry.orderNumber}</p>
                <p className="text-xs text-ink-500">
                  {entry.deliveredAt ? dayLabel(entry.deliveredAt) : entry.status.toLowerCase()}
                </p>
              </div>
              <div className="text-right">
                {entry.pointsEarned ? (
                  <p className="font-bold text-forest-600">+{entry.pointsEarned}</p>
                ) : null}
                {entry.pointsRedeemed ? <p className="text-xs text-ink-500">−{entry.pointsRedeemed} redeemed</p> : null}
              </div>
            </div>
          ))}
        </div>
        {!wallet.data?.history.length ? (
          <EmptyState compact title="No points yet" body="Your first delivered order starts the balance." />
        ) : null}
      </section>
    </div>
  );
}

export function Favorites() {
  const profile = useProfile();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Favourites</h1>
        <p className="text-sm text-ink-500">Shops you order from often.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(profile.data?.favorites ?? []).map((favorite) => (
          <div key={favorite.id} className="card flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <Link to={`/shop/${favorite.slug}`} className="text-sm font-bold text-forest-800 hover:underline">
                {favorite.name}
              </Link>
              <p className="truncate text-xs text-ink-500">{favorite.addressLine}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                ★ {favorite.ratingAvg.toFixed(1)} · {favorite.isOpen ? 'open now' : 'closed'}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-quiet px-3 py-2 text-xs"
              onClick={async () => {
                try {
                  await apiPost(`/users/me/favorites/${favorite.shopId}`);
                  toast.success('Removed from favourites');
                  void profile.refetch();
                } catch (error) {
                  toast.error((error as Error).message);
                }
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {!profile.isLoading && !profile.data?.favorites.length ? (
        <EmptyState
          title="No favourites yet"
          body="Tap “Save shop” on any shop page to keep it here."
          action={
            <Link to="/home" className="btn btn-primary">
              Browse shops
            </Link>
          }
        />
      ) : null}
    </div>
  );
}

export function Notifications() {
  const notifications = useNotifications();

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-forest-800">Notifications</h1>
          <p className="text-sm text-ink-500">Order updates, promos and platform messages.</p>
        </div>
        <button
          type="button"
          className="btn btn-quiet text-xs"
          onClick={async () => {
            try {
              await apiPost('/users/me/notifications/read', {});
              toast.success('All marked as read');
              void notifications.refetch();
            } catch (error) {
              toast.error((error as Error).message);
            }
          }}
        >
          Mark all read
        </button>
      </div>

      <div className="space-y-2">
        {(notifications.data?.notifications ?? []).map((entry) => (
          <article
            key={entry.id}
            className={`card p-4 ${entry.isRead ? '' : 'border-forest-200 bg-forest-50'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-forest-800">{entry.title}</p>
                <p className="mt-1 text-sm text-ink-700">{entry.body}</p>
              </div>
              <span className="shrink-0 text-xs text-ink-500">{timeAgo(entry.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>

      {!notifications.isLoading && !notifications.data?.notifications.length ? (
        <EmptyState title="Nothing here yet" body="Order updates land here the moment a shop accepts." />
      ) : null}
    </div>
  );
}
