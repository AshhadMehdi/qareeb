import { Link } from 'react-router-dom';
import { rupees, distance, etaRange } from '../lib/format';
import type { Product, ProductSearchHit, Shop } from '../lib/types';
import { QuantityStepper } from './ui';
import { IconClock, IconPlus, IconStar } from './icons';
import { useCart, quantityFor } from '../store/cart';
import { toast } from 'sonner';

export const CATEGORY_LABELS: Record<string, string> = {
  biryani: 'Biryani & Pulao',
  karahi: 'Karahi & Handi',
  bbq: 'BBQ & Tikka',
  chapli: 'Chapli & Kebab',
  pizza: 'Pizza',
  burgers: 'Burgers',
  cafe: 'Cafe & Chai',
  grocery: 'Karyana',
  vegetables: 'Sabzi',
  fruit: 'Fruit',
  meat: 'Meat',
  dairy: 'Dairy',
  bakery: 'Bakery',
  pharmacy: 'Pharmacy',
  drinks: 'Drinks',
  household: 'Household',
};

const cuisine = (shop: Shop) => CATEGORY_LABELS[shop.category] ?? shop.category;

/** Deep-emerald monogram tile, used where a shop has no photograph yet. */
function Monogram({ name, className = '' }: { name: string; className?: string }) {
  const initials = name
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
  return (
    <span
      className={`grid place-items-center bg-forest-800 text-sm font-bold tracking-widest text-gold-200 ${className}`}
    >
      {initials}
    </span>
  );
}

/** One badge per card — never a pile of them. */
function ShopBadge({ shop }: { shop: Shop }) {
  const label = shop.freeDelivery
    ? 'Free delivery'
    : shop.ratingAvg >= 4.6
      ? 'Popular'
      : shop.minOrder === 0
        ? 'No minimum'
        : null;
  if (!label) return null;
  return (
    <span className="rounded-full bg-cream-50/95 px-2.5 py-1 text-[11px] font-bold text-forest-800 shadow-paper backdrop-blur">
      {label}
    </span>
  );
}

function ClosedNote({ shop }: { shop: Shop }) {
  if (shop.openNow) return null;
  return <p className="mt-1 text-xs font-semibold text-clay-600">Closed · opens 08:00</p>;
}

/**
 * The card that carries discovery. Photo, name, cuisine, time, fee, one badge —
 * nothing else.
 */
export function ShopCard({
  shop,
  onHover,
  selected = false,
}: {
  shop: Shop;
  onHover?: () => void;
  selected?: boolean;
}) {
  return (
    <Link
      to={`/shop/${shop.slug}`}
      onMouseEnter={onHover}
      className={`card block overflow-hidden transition ${
        selected ? 'border-forest-400 ring-2 ring-forest-100' : 'hover:border-forest-200'
      }`}
    >
      <div className="relative h-36 w-full overflow-hidden bg-forest-800">
        {shop.coverUrl ? (
          <img
            src={shop.coverUrl}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover transition duration-500 hover:scale-[1.03] ${
              shop.openNow ? '' : 'opacity-60 saturate-50'
            }`}
          />
        ) : (
          <Monogram name={shop.name} className="h-full w-full text-2xl" />
        )}
        <div className="absolute left-2.5 top-2.5">
          <ShopBadge shop={shop} />
        </div>
      </div>

      <div className="p-3.5">
        <p className="truncate text-[15px] font-bold text-forest-800">{shop.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
          <IconStar className="h-3 w-3 text-gold-400" />
          <span className="font-semibold text-ink-700">{shop.ratingAvg.toFixed(1)}</span>
          <span>· {cuisine(shop)}</span>
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-700">
          <IconClock className="h-3.5 w-3.5 text-ink-500" />
          {etaRange(shop.etaMinutes)}
          <span className="text-cream-400">|</span>
          {shop.deliveryFee ? `${rupees(shop.deliveryFee)} delivery` : 'Free delivery'}
        </p>
        <ClosedNote shop={shop} />
      </div>
    </Link>
  );
}

/** Large poster card for Tonight's picks. */
export function ShopPoster({ shop }: { shop: Shop }) {
  return (
    <Link
      to={`/shop/${shop.slug}`}
      className="group relative block h-52 w-[19rem] shrink-0 overflow-hidden rounded-card bg-forest-800 shadow-paper sm:w-[22rem]"
    >
      {shop.coverUrl ? (
        <img
          src={shop.coverUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
      ) : (
        <Monogram name={shop.name} className="h-full w-full text-3xl" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-forest-900/85 via-forest-900/25 to-transparent" />
      <div className="absolute left-3 top-3">
        <ShopBadge shop={shop} />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4 text-cream-50">
        <p className="text-lg font-bold leading-tight">{shop.name}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-cream-100">
          <span className="flex items-center gap-1 font-semibold">
            <IconStar className="h-3 w-3 text-gold-300" />
            {shop.ratingAvg.toFixed(1)}
          </span>
          <span>· {cuisine(shop)}</span>
          <span>· {etaRange(shop.etaMinutes)}</span>
          <span>· {shop.deliveryFee ? `${rupees(shop.deliveryFee)} delivery` : 'Free'}</span>
        </p>
      </div>
    </Link>
  );
}

/** Product tile for the home rails: popular, favourites. */
export function ProductTile({
  product,
  shop,
}: {
  product: Product;
  shop: { id: string; name: string; slug: string };
}) {
  const groups = useCart((state) => state.groups);
  const add = useCart((state) => state.add);
  const quantity = quantityFor(groups, shop.id, product.id);
  const soldOut = product.stock <= 0;

  return (
    <div className="card w-[10.5rem] shrink-0 overflow-hidden">
      <div className="relative h-28 w-full overflow-hidden bg-forest-800">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <Monogram name={product.name} className="h-full w-full text-xl" />
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-1 text-[13px] font-bold text-forest-800">{product.name}</p>
        <p className="truncate text-[11px] text-ink-500">{shop.name}</p>
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-sm font-bold text-ink-900">{rupees(product.price)}</span>
          {soldOut ? (
            <span className="text-[11px] font-semibold text-ink-500">Sold out</span>
          ) : quantity > 0 ? (
            <span className="rounded-full bg-forest-800 px-2 py-0.5 text-[11px] font-bold text-cream-50">
              {quantity} in cart
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Add ${product.name}`}
              className="grid h-7 w-7 place-items-center rounded-full bg-forest-800 text-cream-50"
              onClick={() => {
                add(shop, product);
                toast.success(`${product.name} added`);
              }}
            >
              <IconPlus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductSearchCard({ hit }: { hit: ProductSearchHit }) {
  const groups = useCart((state) => state.groups);
  const add = useCart((state) => state.add);
  const setQuantity = useCart((state) => state.setQuantity);
  const quantity = quantityFor(groups, hit.shop.id, hit.id);

  return (
    <div className="card flex items-center gap-3 p-3.5">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-forest-800">
        {hit.imageUrl ? (
          <img src={hit.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <Monogram name={hit.name} className="h-full w-full" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-forest-800">{hit.name}</p>
        <p className="truncate text-xs text-ink-500">
          {hit.shop.name} · {hit.shop.etaMinutes} min · {distance(hit.shop.distanceKm)}
        </p>
        <p className="mt-1 text-sm font-bold text-ink-900">
          {rupees(hit.price)} <span className="text-xs font-medium text-ink-500">/ {hit.unit}</span>
        </p>
      </div>
      {hit.stock > 0 ? (
        quantity > 0 ? (
          <QuantityStepper
            value={quantity}
            max={Math.max(hit.stock, 1)}
            onChange={(next) => setQuantity(hit.shop.id, hit.id, next)}
          />
        ) : (
          <button
            type="button"
            className="btn btn-primary px-3 py-2 text-xs"
            onClick={() => {
              add({ id: hit.shop.id, name: hit.shop.name, slug: hit.shop.slug }, hit);
              toast.success(`${hit.name} added`);
            }}
          >
            Add
          </button>
        )
      ) : (
        <span className="text-xs font-semibold text-ink-500">Out of stock</span>
      )}
    </div>
  );
}

export function ProductRow({
  product,
  shop,
  compact = false,
  onOpen,
}: {
  product: Product;
  shop: { id: string; name: string; slug: string };
  compact?: boolean;
  /** tapping the row opens the dish sheet; the Add button still adds directly */
  onOpen?: () => void;
}) {
  const groups = useCart((state) => state.groups);
  const add = useCart((state) => state.add);
  const setQuantity = useCart((state) => state.setQuantity);
  const quantity = quantityFor(groups, shop.id, product.id);
  const discounted = product.compareAtPrice && product.compareAtPrice > product.price;

  return (
    <div className={`flex items-center gap-3 ${compact ? 'py-2.5' : 'py-3.5'}`}>
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={onOpen ? `Open ${product.name}` : undefined}
        className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-forest-800 disabled:cursor-default"
      >
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <Monogram name={product.name} className="h-full w-full" />
        )}
      </button>
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="min-w-0 flex-1 text-left disabled:cursor-default"
      >
        <p className="truncate text-sm font-semibold text-ink-900">{product.name}</p>
        {product.description ? (
          <p className="line-clamp-2 text-xs text-ink-500">{product.description}</p>
        ) : (
          <p className="text-xs text-ink-500">
            {product.unit}
            {product.stock <= 5 && product.stock > 0 ? ` · only ${product.stock} left` : ''}
          </p>
        )}
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-sm font-bold text-ink-900">{rupees(product.price)}</span>
          {discounted ? (
            <span className="text-xs text-ink-500 line-through">{rupees(product.compareAtPrice!)}</span>
          ) : null}
        </p>
      </button>
      {product.stock <= 0 ? (
        <span className="chip border-cream-300 text-ink-500">Sold out</span>
      ) : quantity > 0 ? (
        <QuantityStepper
          value={quantity}
          max={Math.max(product.stock, 1)}
          onChange={(next) => setQuantity(shop.id, product.id, next)}
        />
      ) : (
        <button
          type="button"
          className="btn btn-ghost px-3 py-2 text-xs"
          onClick={() => {
            add(shop, product);
            toast.success(`${product.name} added to cart`);
          }}
        >
          Add
        </button>
      )}
    </div>
  );
}

export { Monogram };
