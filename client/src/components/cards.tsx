import { Link } from 'react-router-dom';
import { rupees, distance } from '../lib/format';
import type { Product, ProductSearchHit, Shop } from '../lib/types';
import { QuantityStepper, Stars, Tag } from './ui';
import { useCart, quantityFor } from '../store/cart';
import { toast } from 'sonner';

const CATEGORY_LABELS: Record<string, string> = {
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

export function ShopCard({
  shop,
  onHover,
  selected = false,
}: {
  shop: Shop;
  onHover?: () => void;
  selected?: boolean;
}) {
  const closed = !shop.openNow;
  return (
    <Link
      to={`/shop/${shop.slug}`}
      onMouseEnter={onHover}
      className={`card block overflow-hidden transition ${
        selected ? 'border-forest-400 ring-2 ring-forest-100' : 'hover:border-forest-200'
      }`}
    >
      <div className="flex gap-3 p-3.5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-forest-50 text-lg font-bold text-forest-700">
          {shop.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[15px] font-bold text-forest-800">{shop.name}</p>
            {shop.freeDelivery ? <Tag tone="forest">Free delivery</Tag> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-500">
            {CATEGORY_LABELS[shop.category] ?? shop.category} · {shop.area}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-700">
            <Stars rating={shop.ratingAvg} count={shop.ratingCount} />
            <span>{shop.etaMinutes} min</span>
            <span>{distance(shop.distanceKm)}</span>
            <span>{shop.deliveryFee ? rupees(shop.deliveryFee) + ' delivery' : 'Free'}</span>
          </div>
          {closed ? (
            <p className="mt-2 text-xs font-semibold text-clay-600">
              Closed right now · opens {Object.values(shop.hours)[0]?.open ?? '08:00'}
            </p>
          ) : shop.minOrder ? (
            <p className="mt-2 text-xs text-ink-500">Minimum order {rupees(shop.minOrder)}</p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function ProductSearchCard({ hit }: { hit: ProductSearchHit }) {
  const groups = useCart((state) => state.groups);
  const add = useCart((state) => state.add);
  const setQuantity = useCart((state) => state.setQuantity);
  const quantity = quantityFor(groups, hit.shop.id, hit.id);

  return (
    <div className="card flex items-center gap-3 p-3.5">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cream-200 text-base font-semibold text-forest-700">
        {hit.name.slice(0, 2).toUpperCase()}
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
            onChange={(next) =>
              next === 0
                ? setQuantity(hit.shop.id, hit.id, 0)
                : setQuantity(hit.shop.id, hit.id, next)
            }
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
}: {
  product: Product;
  shop: { id: string; name: string; slug: string };
  compact?: boolean;
}) {
  const groups = useCart((state) => state.groups);
  const add = useCart((state) => state.add);
  const setQuantity = useCart((state) => state.setQuantity);
  const quantity = quantityFor(groups, shop.id, product.id);
  const discounted = product.compareAtPrice && product.compareAtPrice > product.price;

  return (
    <div className={`flex items-center gap-3 ${compact ? 'py-2.5' : 'py-3.5'}`}>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream-200 text-sm font-semibold text-forest-700">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
        ) : (
          product.name.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-900">{product.name}</p>
        <p className="text-xs text-ink-500">
          {product.unit}
          {product.stock <= 5 && product.stock > 0 ? ` · only ${product.stock} left` : ''}
        </p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-sm font-bold text-ink-900">{rupees(product.price)}</span>
          {discounted ? (
            <span className="text-xs text-ink-500 line-through">{rupees(product.compareAtPrice!)}</span>
          ) : null}
        </p>
      </div>
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
