import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState, QuantityStepper, Tag } from '../../components/ui';
import { cartCount, cartSubtotal, groupSubtotal, lineCount, useCart } from '../../store/cart';
import { useLocation } from '../../store/location';
import { usePromos } from '../../lib/queries';
import { rupees } from '../../lib/format';

const TIPS = [0, 50, 100, 200];

export default function Cart() {
  const { groups, setQuantity, remove, setPromo, setTip, setNote, setLineNote, clear } = useCart();
  const point = useLocation((state) => state.point);
  const navigate = useNavigate();
  const promos = usePromos();
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);

  const items = cartCount(groups);
  const subtotal = cartSubtotal(groups);

  if (!groups.length) {
    return (
      <EmptyState
        title="Your cart is empty"
        body="Start with the karyana or the sabzi mandi around the corner — you can mix shops in one order."
        action={
          <Link to="/home" className="btn btn-primary">
            Browse shops in {point.area ?? 'Abbottabad'}
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-forest-800">Your cart</h1>
          <p className="text-sm text-ink-500">
            {items} {items === 1 ? 'item' : 'items'} from {groups.length}{' '}
            {groups.length === 1 ? 'shop' : 'shops'} · delivering to {point.label}
          </p>
        </div>
        <button type="button" className="btn btn-quiet text-xs" onClick={() => clear()}>
          Empty cart
        </button>
      </div>

      {groups.map((group) => (
        <section key={group.shopId} className="card overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-cream-200 bg-cream-100 px-4 py-3">
            <div className="min-w-0">
              <Link to={`/shop/${group.shopSlug}`} className="text-sm font-bold text-forest-800 hover:underline">
                {group.shopName}
              </Link>
              <p className="text-xs text-ink-500">
                {lineCount(group)} {lineCount(group) === 1 ? 'item' : 'items'} · {rupees(groupSubtotal(group))}
              </p>
            </div>
            <Tag tone="forest">Shop {groups.indexOf(group) + 1}</Tag>
          </header>

          <div className="divide-y divide-cream-200">
            {group.lines.map((line) => (
              <div key={line.productId} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream-200 text-xs font-semibold text-forest-700">
                    {line.imageUrl ? (
                      <img src={line.imageUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                    ) : (
                      line.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{line.name}</p>
                    <p className="text-xs text-ink-500">
                      {rupees(line.price)} / {line.unit}
                    </p>
                  </div>
                  <QuantityStepper
                    value={line.quantity}
                    max={Math.max(line.stock, 1)}
                    size="small"
                    onChange={(next) =>
                      next === 0
                        ? remove(group.shopId, line.productId)
                        : setQuantity(group.shopId, line.productId, next)
                    }
                  />
                  <span className="hidden w-20 text-right text-sm font-bold text-ink-900 sm:block">
                    {rupees(line.price * line.quantity)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 pl-13">
                  <button
                    type="button"
                    className="text-xs font-semibold text-forest-600"
                    onClick={() =>
                      setNoteOpenFor(
                        noteOpenFor === `${group.shopId}:${line.productId}`
                          ? null
                          : `${group.shopId}:${line.productId}`,
                      )
                    }
                  >
                    {line.note ? 'Edit note' : 'Add a note'}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-clay-600"
                    onClick={() => remove(group.shopId, line.productId)}
                  >
                    Remove
                  </button>
                  {line.note ? <span className="text-xs text-ink-500">“{line.note}”</span> : null}
                </div>

                {noteOpenFor === `${group.shopId}:${line.productId}` ? (
                  <input
                    className="input mt-2"
                    placeholder="e.g. ripe bananas please"
                    defaultValue={line.note ?? ''}
                    maxLength={200}
                    onBlur={(event) => setLineNote(group.shopId, line.productId, event.target.value)}
                  />
                ) : null}
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-cream-200 bg-cream-50 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input max-w-40 uppercase"
                placeholder="Promo code"
                defaultValue={group.promoCode ?? ''}
                onBlur={(event) => setPromo(group.shopId, event.target.value.trim() || null)}
              />
              <div className="flex flex-wrap gap-1.5">
                {(promos.data?.promos ?? []).slice(0, 3).map((promo) => (
                  <button
                    key={promo.id}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setPromo(group.shopId, promo.code);
                      toast.success(`${promo.code} will be checked at checkout`);
                    }}
                  >
                    {promo.code}
                  </button>
                ))}
              </div>
            </div>
            {group.promoCode ? (
              <p className="text-xs text-forest-600">
                {group.promoCode} applied — the discount is confirmed on the checkout screen.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <span className="label">Rider tip</span>
              {TIPS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={`chip ${(group.tip ?? 0) === amount ? 'chip-active' : ''}`}
                  onClick={() => setTip(group.shopId, amount)}
                >
                  {amount === 0 ? 'No tip' : rupees(amount)}
                </button>
              ))}
            </div>

            <input
              className="input"
              placeholder="Note for the shop (optional)"
              defaultValue={group.note ?? ''}
              maxLength={300}
              onBlur={(event) => setNote(group.shopId, event.target.value)}
            />
          </div>
        </section>
      ))}

      <div className="fixed inset-x-0 bottom-[4.6rem] z-40 px-4 lg:bottom-4">
        <div className="card mx-auto flex max-w-2xl items-center gap-3 border-forest-200 p-3.5 shadow-lg">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-500">Items subtotal</p>
            <p className="text-lg font-bold text-forest-800">{rupees(subtotal)}</p>
            <p className="text-[11px] text-ink-500">Delivery, service fee and discounts are applied at checkout.</p>
          </div>
          <button type="button" className="btn btn-primary px-5 py-3" onClick={() => navigate('/checkout')}>
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
