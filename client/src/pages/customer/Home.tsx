import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MapView from '../../components/MapView';
import { ShopCard } from '../../components/cards';
import { EmptyState, SectionHeading, Skeleton, Tag } from '../../components/ui';
import { IconPin, IconSearch } from '../../components/icons';
import { useConfig, useOrders, useShopCategories, useShops } from '../../lib/queries';
import { distance, greeting, rupees } from '../../lib/format';
import { useAuth } from '../../store/auth';
import { useLocation } from '../../store/location';
import type { Shop } from '../../lib/types';

const SORTS = [
  { key: 'distance', label: 'Nearest' },
  { key: 'rating', label: 'Top rated' },
  { key: 'fee', label: 'Cheapest delivery' },
  { key: 'eta', label: 'Fastest' },
] as const;

export default function Home() {
  const user = useAuth((state) => state.user);
  const { point } = useLocation();
  const [category, setCategory] = useState<string>('');
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('distance');
  const [openNow, setOpenNow] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selected, setSelected] = useState<Shop | null>(null);

  const config = useConfig();
  const categories = useShopCategories();
  const shops = useShops({ lat: point.lat, lng: point.lng, category: category || undefined, sort, openNow });
  const orders = useOrders('ALL');

  const activeOrder = useMemo(
    () => orders.data?.orders.find((order) => !['DELIVERED', 'CANCELLED'].includes(order.status)) ?? null,
    [orders.data],
  );

  const list = shops.data?.shops ?? [];
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="space-y-6">
      {/* Fraunces appears here and nowhere else. */}
      <section>
        <p className="font-display text-3xl leading-tight text-forest-800 sm:text-4xl">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </p>
        <p className="mt-1.5 text-sm text-ink-500">
          {list.length || '—'} shops deliver to {point.source === 'address' ? point.label : point.area ?? point.label} today.{' '}
          <button
            type="button"
            onClick={() => document.getElementById('qareeb-location-trigger')?.click()}
            className="font-semibold text-forest-600 underline decoration-forest-100 underline-offset-2"
          >
            Change
          </button>
        </p>
      </section>

      {config.data?.announcement ? (
        <div className="card flex items-start gap-3 border-forest-100 bg-forest-50 p-3.5">
          <IconPin className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
          <p className="text-sm text-forest-700">{config.data.announcement}</p>
        </div>
      ) : null}

      <Link to="/search" className="card flex items-center gap-3 p-3.5 sm:hidden">
        <IconSearch className="h-4 w-4 text-ink-500" />
        <span className="text-sm text-ink-500">Search shops and products</span>
      </Link>

      {activeOrder ? (
        <Link
          to={`/orders/${activeOrder.id}`}
          className="card flex items-center justify-between gap-3 border-forest-200 bg-forest-600 p-4 text-cream-50"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-cream-200">
              {activeOrder.status === 'ON_THE_WAY' ? 'On the way to you' : 'Order in progress'}
            </p>
            <p className="truncate text-sm font-bold">
              {activeOrder.shop?.name} · {rupees(activeOrder.total)}
            </p>
          </div>
          <span className="rounded-full bg-cream-50 px-3 py-1.5 text-xs font-bold text-forest-700">Track</span>
        </Link>
      ) : null}

      <section className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            className={`chip ${category === '' ? 'chip-active' : ''}`}
            onClick={() => setCategory('')}
          >
            All shops
          </button>
          {(categories.data?.categories ?? []).map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`chip ${category === entry.key ? 'chip-active' : ''}`}
              onClick={() => setCategory(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`chip ${sort === option.key ? 'chip-active' : ''}`}
              onClick={() => setSort(option.key)}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            className={`chip ${openNow ? 'chip-active' : ''}`}
            onClick={() => setOpenNow((current) => !current)}
          >
            Open now
          </button>
          <div className="ml-auto flex rounded-full border border-cream-300 bg-cream-50 p-0.5">
            {(['list', 'map'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                  view === mode ? 'bg-forest-600 text-cream-50' : 'text-forest-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </section>

      {view === 'map' ? (
        <section className="space-y-3">
          <MapView
            center={[point.lat, point.lng]}
            zoom={14}
            height="20rem"
            markers={[
              { id: 'me', lat: point.lat, lng: point.lng, label: 'You', kind: 'home' },
              ...list.map((shop) => ({
                id: shop.id,
                lat: shop.lat,
                lng: shop.lng,
                label: shop.name,
                kind: 'shop' as const,
                selected: selected?.id === shop.id,
                onSelect: () => setSelected(shop),
              })),
            ]}
          />
          {selected ? (
            <div className="space-y-2">
              <ShopCard shop={selected} />
              <button type="button" className="btn btn-ghost w-full" onClick={() => setSelected(null)}>
                Clear selection
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-ink-500">Tap a pin on the map to see the shop.</p>
          )}
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2">
          {shops.isLoading
            ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)
            : null}
          {list.map((shop) => (
            <ShopCard key={shop.id} shop={shop} selected={selected?.id === shop.id} onHover={() => setSelected(shop)} />
          ))}
          {!shops.isLoading && !list.length ? (
            <div className="sm:col-span-2">
              <EmptyState
                title="No shops match that yet"
                body="Try a wider radius, a different category, or switch off the open-now filter."
              />
            </div>
          ) : null}
        </section>
      )}

      <section>
        <SectionHeading
          title="Why Qareeb"
          subtitle="Built for Abbottabad's mohallas, not for a warehouse on the ring road."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: 'Several shops, one delivery', body: 'Fill your cart from the karyana and the bakery, then check out once.' },
            { title: 'Live rider tracking', body: 'Watch your rider move from the shop to your gate on the map.' },
            { title: 'Pay how you like', body: 'Cash on delivery, JazzCash, Easypaisa or Qareeb points.' },
          ].map((item) => (
            <div key={item.title} className="card p-4">
              <p className="text-sm font-bold text-forest-800">{item.title}</p>
              <p className="mt-1 text-sm text-ink-500">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {list[0] ? (
        <p className="flex items-center justify-center gap-2 text-xs text-ink-500">
          <Tag tone="forest">{distance(list[0].distanceKm)} to the closest shop</Tag>
        </p>
      ) : null}
    </div>
  );
}
