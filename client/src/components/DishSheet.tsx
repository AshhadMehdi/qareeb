import { useState } from 'react';
import { toast } from 'sonner';
import { rupees } from '../lib/format';
import type { Product, Shop } from '../lib/types';
import { IconStar } from './icons';
import { useCart, quantityFor } from '../store/cart';

/**
 * Dish sheet — the premium food page: large photograph, the description the
 * kitchen wrote, and one priced action that never scrolls away.
 */
export default function DishSheet({
  product,
  shop,
  onClose,
}: {
  product: Product;
  shop: Pick<Shop, 'id' | 'name' | 'slug' | 'ratingAvg' | 'ratingCount'>;
  onClose: () => void;
}) {
  const add = useCart((state) => state.add);
  const setQuantity = useCart((state) => state.setQuantity);
  const groups = useCart((state) => state.groups);
  const inCart = quantityFor(groups, shop.id, product.id);
  const [quantity, setQuantityLocal] = useState(Math.max(inCart, 1));
  const [note, setNote] = useState('');

  const soldOut = product.stock <= 0;
  const compareAt = product.compareAtPrice && product.compareAtPrice > product.price ? product.compareAtPrice : null;

  const commit = () => {
    if (soldOut) return;
    add({ id: shop.id, name: shop.name, slug: shop.slug }, product, quantity);
    if (inCart > 0) setQuantity(shop.id, product.id, quantity);
    if (note.trim()) useCart.getState().setLineNote(shop.id, product.id, note.trim());
    toast.success(`${quantity} × ${product.name} added`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-cream-300 bg-cream-50 shadow-xl sm:max-w-lg sm:rounded-3xl">
        {/* Photography carries the page. */}
        <div className="relative h-56 w-full shrink-0 bg-forest-800">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-3xl font-bold tracking-widest text-gold-200">
              {product.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full bg-cream-50/95 px-3 py-1.5 text-xs font-bold text-forest-800 shadow-paper"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 pb-4">
          <div>
            <h2 className="text-xl font-bold leading-tight text-forest-800">{product.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
              <span className="flex items-center gap-1 font-semibold text-ink-700">
                <IconStar className="h-3 w-3 text-gold-400" />
                {shop.ratingAvg.toFixed(1)}
              </span>
              <span>· {shop.ratingCount} ratings</span>
              <span>· {product.unit}</span>
              <span>· {shop.name}</span>
            </p>
          </div>

          {product.description ? (
            <p className="text-sm leading-relaxed text-ink-700">{product.description}</p>
          ) : null}

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink-900">{rupees(product.price)}</span>
            {compareAt ? (
              <>
                <span className="text-sm text-ink-500 line-through">{rupees(compareAt)}</span>
                <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-bold text-gold-600">
                  Save {rupees(compareAt - product.price)}
                </span>
              </>
            ) : null}
          </div>

          {product.stock > 0 && product.stock <= 5 ? (
            <p className="text-xs font-semibold text-clay-600">Only {product.stock} left at the kitchen</p>
          ) : null}

          <div>
            <p className="label">Quantity</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-ghost h-9 w-9 p-0 text-lg leading-none"
                onClick={() => setQuantityLocal((value) => Math.max(1, value - 1))}
                aria-label="Fewer"
              >
                −
              </button>
              <span className="w-10 text-center text-base font-bold tabular-nums text-ink-900">{quantity}</span>
              <button
                type="button"
                className="btn btn-ghost h-9 w-9 p-0 text-lg leading-none"
                onClick={() => setQuantityLocal((value) => Math.min(Math.max(product.stock, 1), value + 1))}
                aria-label="More"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="dish-note">
              Anything for the kitchen?
            </label>
            <input
              id="dish-note"
              className="input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={200}
              placeholder="Less spicy, extra chutney…"
            />
          </div>
        </div>

        {/* The action stays put, with the price attached to it. */}
        <div className="shrink-0 border-t border-cream-300 bg-cream-50 p-4 pb-safe">
          <button
            type="button"
            className="btn btn-primary w-full justify-between px-4 py-3.5 text-sm"
            disabled={soldOut}
            onClick={commit}
          >
            <span>{soldOut ? 'Sold out' : 'Add to cart'}</span>
            {!soldOut ? <span className="tabular-nums">{rupees(product.price * quantity)}</span> : null}
          </button>
        </div>
      </div>
    </div>
  );
}
