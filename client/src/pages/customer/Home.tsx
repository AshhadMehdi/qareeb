import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MapView from '../../components/MapView';
import { ProductTile, ShopCard, ShopPoster } from '../../components/cards';
import { EmptyState, SectionHeading, Skeleton } from '../../components/ui';
import { IconBolt, IconClock, IconPin, IconRepeat, IconSearch } from '../../components/icons';
import {
  useConfig,
  useFeaturedShops,
  useOrders,
  usePopularProducts,
  useShopCategories,
  useShops,
} from '../../lib/queries';
import { greeting, rupees } from '../../lib/format';
import { useAuth } from '../../store/auth';
import { useCart } from '../../store/cart';
import { useLocation } from '../../store/location';
import type { Order, Shop } from '../../lib/types';
import { toast } from 'sonner';

/** What people actually open the app to eat. These map to real search terms. */
const CRAVINGS = [
  { label: 'Biryani', term: 'biryani' },
  { label: 'BBQ', term: 'bbq' },
  { label: 'Karahi', term: 'karahi' },
  { label: 'Chapli Kebab', term: 'kebab' },
  { label: 'Pizza', term: 'pizza' },
  { label: 'Burgers', term: 'burger' },
  { label: 'Cafe & Chai', term: 'chai' },
  { label: 'Karyana', term: 'atta' },
];

const FOOD_CATEGORIES = new Set([
  'biryani',
  'karahi',
  'bbq',
  'chapli',
  'pizza',
  'burgers',
  'cafe',
  'bakery',
  'dairy',
  'meat',
]);

const SORTS = [
  { key: 'distance', label: 'Nearest' },
  { key: 'rating', label: 'Top rated' },
  { key: 'fee', label: 'Cheapest delivery' },
  { key: 'eta', label: 'Fastest' },
] as const;

/** Rebuild a past order in the cart in one tap. */
function useReorder() {
  const add = useCart((state) => state.add);
  const clearGroup = useCart((state) => state.clearGroup);
  const navigate = useNavigate();

  return (order: Order) => {
    const shop = order.shop;
    if (!shop) return;
    clearGroup(shop.id);
    let added = 0;
    for (const item of order.items) {
      if (!item.productId) continue;
      add(
        { id: shop.id, name: shop.name, slug: shop.slug },
        {
          id: item.productId,
          shopId: shop.id,
          name: item.name,
          description: null,
          category: '',
          unit: item.unit,
          price: item.unitPrice,
          compareAtPrice: null,
          imageUrl: item.imageUrl,
          emoji: item.emoji,
          stock: 99,
          isAvailable: true,
          isFeatured: false,
          sortOrder: 0,
        },
        item.quantity,
      );
      added += 1;
    }
    if (!added) {
      toast.error('Those items are no longer available');
      return;
    }
    toast.success(`${shop.name} added back to your cart`);
    navigate('/cart');
  };
}

function Rail({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; to: string };
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold tracking-tight text-forest-800">{title}</h2>
          {subtitle ? <p className="text-xs text-ink-500">{subtitle}</p> : null}
        </div>
        {action ? (
          <Link to={action.to} className="text-xs font-bold text-forest-600 underline underline-offset-4">
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  const user = useAuth((state) => state.user);
  const { point } = useLocation();
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState<string>('');
  const [sort, setSort] = useState<(typeof SORTS)[number]['key']>('distance');
  const [openNow, setOpenNow] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selected, setSelected] = useState<Shop | null>(null);
  const navigate = useNavigate();
  const reorder = useReorder();

  const config = useConfig();
  const categories = useShopCategories();
  const featured = useFeaturedShops(point);
  const popular = usePopularProducts(point);
  const shops = useShops({ lat: point.lat, lng: point.lng, category: category || undefined, sort, openNow });
  const orders = useOrders('ALL');

  const activeOrder = useMemo(
    () => orders.data?.orders.find((order) => !['DELIVERED', 'CANCELLED'].includes(order.status)) ?? null,
    [orders.data],
  );

  const list = shops.data?.shops ?? [];
  const firstName = user?.name?.split(' ')[0];
  // The quickest kitchens and food shops — a pharmacy being close is not a
  // reason to eat there.
  const fast = useMemo(
    () =>
      [...list]
        .filter((shop) => FOOD_CATEGORIES.has(shop.category))
        .sort((a, b) => a.etaMinutes - b.etaMinutes)
        .slice(0, 4),
    [list],
  );

  const pastOrders = useMemo(() => {
    const seen = new Set<string>();
    return (orders.data?.orders ?? [])
      .filter((order) => order.status === 'DELIVERED')
      .filter((order) => {
        const key = order.shop?.id ?? order.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
  }, [orders.data]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (term.trim().length < 2) return;
    navigate(`/search?q=${encodeURIComponent(term.trim())}`);
  };

  return (
    <div className="space-y-8">
      {/* Hero: where you are, what you want. Fraunces appears here and nowhere else. */}
      <section className="hero-wash -mx-4 px-4 pb-2 pt-1">
        <p className="font-display text-3xl leading-tight text-forest-800 sm:text-4xl">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </p>
        <button
          type="button"
          onClick={() => document.getElementById('qareeb-location-trigger')?.click()}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-cream-50 px-3 py-1.5 text-sm font-semibold text-forest-800"
        >
          <IconPin className="h-3.5 w-3.5 text-gold-500" />
          {point.source === 'address' ? `${point.label} · ` : ''}
          {point.area ?? point.label}, Abbottabad
          <span className="text-xs font-bold text-forest-600">Change</span>
        </button>

        <p className="mt-5 text-[15px] font-bold text-ink-900">What are you craving?</p>
        <form onSubmit={submitSearch} className="mt-2">
          <div className="flex items-center gap-2 rounded-2xl border border-cream-300 bg-cream-50 px-3.5 py-2.5 shadow-paper focus-within:border-forest-300">
            <IconSearch className="h-4 w-4 shrink-0 text-ink-500" />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search biryani, pizza, karahi…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-500"
              aria-label="Search food and shops"
            />
            {term.trim().length >= 2 ? (
              <button type="submit" className="text-xs font-bold text-forest-600">
                Go
              </button>
            ) : null}
          </div>
        </form>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CRAVINGS.map((entry) => (
            <Link
              key={entry.label}
              to={`/search?q=${encodeURIComponent(entry.term)}`}
              className="chip whitespace-nowrap bg-cream-50"
            >
              {entry.label}
            </Link>
          ))}
        </div>
      </section>

      {activeOrder ? (
        <Link
          to={`/orders/${activeOrder.id}`}
          className="card flex items-center justify-between gap-3 border-forest-200 bg-forest-800 p-4 text-cream-50"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-200">
              {activeOrder.status === 'ON_THE_WAY' ? 'On the way to you' : 'Order in progress'}
            </p>
            <p className="truncate text-sm font-bold">
              {activeOrder.shop?.name} · {rupees(activeOrder.total)}
            </p>
          </div>
          <span className="rounded-full bg-cream-50 px-3 py-1.5 text-xs font-bold text-forest-800">Track</span>
        </Link>
      ) : null}

      {config.data?.announcement ? (
        <div className="card flex items-start gap-3 border-gold-100 bg-gold-50 p-3.5">
          <IconPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
          <p className="text-sm text-ink-700">{config.data.announcement}</p>
        </div>
      ) : null}

      <section className="grid gap-2 sm:grid-cols-3" aria-label="The Qareeb promise">
        <div className="card flex items-center gap-3 border-forest-100 bg-forest-50/70 p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-forest-100 text-forest-700"><IconBolt className="h-4 w-4" /></span>
          <div><p className="text-xs font-bold text-forest-800">Local, not far away</p><p className="text-[11px] text-ink-500">Neighbourhood shops first</p></div>
        </div>
        <div className="card flex items-center gap-3 border-gold-100 bg-gold-50/70 p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold-100 text-gold-600"><IconClock className="h-4 w-4" /></span>
          <div><p className="text-xs font-bold text-forest-800">Clear arrival times</p><p className="text-[11px] text-ink-500">No vague delivery windows</p></div>
        </div>
        <div className="card flex items-center gap-3 border-cream-300 bg-cream-50 p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cream-200 text-forest-700"><IconRepeat className="h-4 w-4" /></span>
          <div><p className="text-xs font-bold text-forest-800">Easy to reorder</p><p className="text-[11px] text-ink-500">Your usuals stay close</p></div>
        </div>
      </section>

      {/* Tonight's picks — the big premium cards. */}
      <Rail title="Tonight's picks" subtitle="The kitchens Abbottabad keeps going back to" action={{ label: 'See all', to: '/search' }}>
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {featured.isLoading
            ? Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-52 w-[19rem] shrink-0" />)
            : (() => {
                const all = featured.data?.shops ?? [];
                const kitchens = all.filter((shop) => FOOD_CATEGORIES.has(shop.category));
                return (kitchens.length >= 3 ? kitchens : all).slice(0, 6).map((shop) => (
                  <ShopPoster key={shop.id} shop={shop} />
                ));
              })()}
        </div>
      </Rail>

      {pastOrders.length ? (
        <Rail title="Order again" subtitle="One tap and your usual is back in the cart">
          <div className="space-y-2.5">
            {pastOrders.map((order) => (
              <div key={order.id} className="card flex items-center gap-3 p-3.5">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-forest-800">
                  {order.shop?.coverUrl ? (
                    <img src={order.shop.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-xs font-bold text-gold-200">
                      {(order.shop?.name ?? 'Q').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-forest-800">{order.shop?.name ?? 'Previous order'}</p>
                  <p className="truncate text-xs text-ink-500">
                    {order.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}
                  </p>
                </div>
                <button type="button" className="btn btn-primary gap-1.5 px-3 py-2 text-xs" onClick={() => reorder(order)}>
                  <IconRepeat className="h-3.5 w-3.5" />
                  Reorder
                </button>
              </div>
            ))}
          </div>
        </Rail>
      ) : null}

      <Rail
        title="Popular right now"
        subtitle="Ranked by what people actually ordered this week"
        action={{ label: 'Search', to: '/search' }}
      >
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {popular.isLoading
            ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-56 w-[10.5rem] shrink-0" />)
            : (popular.data?.products ?? []).map((product) => (
                <ProductTile key={product.id} product={product} shop={product.shop} />
              ))}
        </div>
      </Rail>

      {/* Under 30 minutes — only when there is something genuinely fast. */}
      {fast.length ? (
        <Rail title="Ready fastest" subtitle="Shortest waits near you right now">
          <div className="grid gap-3 sm:grid-cols-2">
            {fast.map((shop) => (
              <Link
                key={shop.id}
                to={`/shop/${shop.slug}`}
                className="card flex items-center gap-3 border-forest-100 p-3"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
                  <IconBolt className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-forest-800">{shop.name}</p>
                  <p className="text-xs text-ink-500">
                    {shop.deliveryFee ? rupees(shop.deliveryFee) : 'Free'} delivery · {shop.ratingAvg.toFixed(1)} rating
                  </p>
                </div>
                <span className="chip gap-1 border-forest-200 text-forest-700">
                  <IconClock className="h-3 w-3" />
                  {shop.etaMinutes} min
                </span>
              </Link>
            ))}
          </div>
        </Rail>
      ) : null}

      {/* Everything nearby, with the map when you want it. */}
      <section className="space-y-3">
        <SectionHeading title="Everything nearby" subtitle={`${list.length} shops deliver to your area`} />
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button type="button" className={`chip ${category === '' ? 'chip-active' : ''}`} onClick={() => setCategory('')}>
            All
          </button>
          {(categories.data?.categories ?? []).map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`chip whitespace-nowrap ${category === entry.key ? 'chip-active' : ''}`}
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
                  view === mode ? 'bg-forest-800 text-cream-50' : 'text-forest-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {view === 'map' ? (
          <div className="space-y-3">
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
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shops.isLoading
              ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-64 w-full" />)
              : null}
            {list.map((shop) => (
              <ShopCard key={shop.id} shop={shop} selected={selected?.id === shop.id} onHover={() => setSelected(shop)} />
            ))}
            {!shops.isLoading && !list.length ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState
                  title="Nothing matches that yet"
                  body="Try a different cuisine, a wider radius, or switch off the open-now filter."
                />
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
