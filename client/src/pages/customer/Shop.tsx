import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductRow } from '../../components/cards';
import { EmptyState, ErrorNote, SectionHeading, Skeleton, Stars, Tag } from '../../components/ui';
import { useShop } from '../../lib/queries';
import { apiPost } from '../../lib/api';
import { distance, rupees, timeAgo } from '../../lib/format';
import { cartCount, cartSubtotal, groupSubtotal, useCart } from '../../store/cart';
import { useLocation } from '../../store/location';
import { useAuth } from '../../store/auth';

export default function ShopPage() {
  const { slug } = useParams<{ slug: string }>();
  const point = useLocation((state) => state.point);
  const groups = useCart((state) => state.groups);
  const token = useAuth((state) => state.token);
  const navigate = useNavigate();
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const query = useShop(slug, point);
  const shop = query.data?.shop;
  const products = query.data?.products ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, typeof products>();
    for (const product of products) {
      const list = map.get(product.category) ?? [];
      list.push(product);
      map.set(product.category, list);
    }
    return [...map.entries()];
  }, [products]);

  const cartTotal = cartSubtotal(groups);
  const cartItems = cartCount(groups);
  const thisShopGroup = groups.find((group) => group.shopId === shop?.id);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (query.isError || !shop) {
    return (
      <EmptyState
        title="This shop is not available"
        body={(query.error as Error | null)?.message ?? 'It may have been paused by the owner.'}
        action={
          <Link to="/home" className="btn btn-primary">
            Back to shops
          </Link>
        }
      />
    );
  }

  const toggleFavorite = async () => {
    if (!token) {
      toast.error('Sign in to save favourites');
      return;
    }
    setFavoriteBusy(true);
    try {
      const result = await apiPost<{ favorite: boolean }>(`/users/me/favorites/${shop.id}`);
      toast.success(result.favorite ? `${shop.name} saved` : `${shop.name} removed`);
      await query.refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setFavoriteBusy(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      <nav className="text-xs text-ink-500">
        <Link to="/home" className="font-semibold text-forest-600">
          Shops
        </Link>
        <span> / {shop.name}</span>
      </nav>

      <header className="card overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 p-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-forest-600 text-lg font-bold text-cream-50">
            {shop.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-forest-800">{shop.name}</h1>
              {shop.openNow ? <Tag tone="forest">Open now</Tag> : <Tag tone="clay">Closed</Tag>}
            </div>
            <p className="mt-1 text-sm text-ink-500">{shop.addressLine}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-700">
              <Stars rating={shop.ratingAvg} count={shop.ratingCount} />
              <span>{shop.etaMinutes} min delivery</span>
              <span>{distance(shop.distanceKm)} away</span>
              <span>{shop.deliveryFee ? `${rupees(shop.deliveryFee)} delivery` : 'Free delivery'}</span>
              {shop.minOrder ? <span>Min {rupees(shop.minOrder)}</span> : null}
            </div>
            {shop.description ? <p className="mt-2 text-sm text-ink-500">{shop.description}</p> : null}
          </div>
          <button
            type="button"
            className="btn btn-quiet text-xs"
            disabled={favoriteBusy}
            onClick={toggleFavorite}
          >
            {shop.isFavorite ? 'Saved' : 'Save shop'}
          </button>
        </div>

        {!shop.deliverable ? (
          <div className="border-t border-clay-100 bg-clay-100/50 px-4 py-3 text-sm font-semibold text-clay-600">
            {shop.name} does not deliver to {point.area ?? point.label} yet. Choose a different address to order.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-cream-200 px-4 py-3 text-xs text-ink-500">
          {Object.entries(shop.hours).map(([day, slot]) => (
            <span key={day} className={slot.closed ? 'opacity-50' : ''}>
              <span className="font-semibold capitalize text-ink-700">{day.slice(0, 3)}</span> {slot.open}–{slot.close}
            </span>
          ))}
        </div>
      </header>

      {query.data?.zones.length ? (
        <div className="flex flex-wrap gap-2">
          {query.data.zones.map((zone) => (
            <span key={zone.id} className="chip">
              {zone.name} · {rupees(zone.fee)}
              {zone.freeAbove ? ` · free above ${rupees(zone.freeAbove)}` : ''}
            </span>
          ))}
        </div>
      ) : null}

      {products.length ? (
        <>
          <div className="sticky top-14 z-30 -mx-4 flex gap-2 overflow-x-auto bg-cream-100/95 px-4 py-2 backdrop-blur no-scrollbar">
            {grouped.map(([category]) => (
              <button
                key={category}
                type="button"
                className="chip"
                onClick={() =>
                  sectionRefs.current[category]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {category}
              </button>
            ))}
          </div>

          <div className="space-y-5">
            {grouped.map(([category, items]) => (
              <section
                key={category}
                ref={(element) => {
                  sectionRefs.current[category] = element;
                }}
                className="card p-4"
              >
                <SectionHeading title={category} subtitle={`${items.length} items`} />
                <div className="divide-y divide-cream-200">
                  {items.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      shop={{ id: shop.id, name: shop.name, slug: shop.slug }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : (
        <EmptyState title="No products listed yet" body="The shop owner has not added items to this catalogue." />
      )}

      {query.data?.reviews.length ? (
        <section className="card p-4">
          <SectionHeading title="What neighbours say" subtitle={`${shop.ratingCount} ratings`} />
          <div className="space-y-3">
            {query.data.reviews.map((review) => (
              <div key={review.id} className="rounded-2xl border border-cream-200 bg-cream-100 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-forest-700">{review.customerName}</span>
                  <span className="text-ink-500">{timeAgo(review.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-wheat-500">{'★'.repeat(review.shopRating)}</p>
                {review.comment ? <p className="mt-1 text-sm text-ink-700">{review.comment}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {cartItems > 0 ? (
        <div className="fixed inset-x-0 bottom-[4.6rem] z-40 px-4 lg:bottom-4">
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="btn btn-primary mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-3 shadow-lg"
          >
            <span>
              {cartItems} {cartItems === 1 ? 'item' : 'items'} in cart
            </span>
            <span>{rupees(cartTotal)} · View cart</span>
          </button>
        </div>
      ) : null}

      {thisShopGroup && shop.minOrder > groupSubtotal(thisShopGroup) ? (
        <ErrorNote>
          Add {rupees(shop.minOrder - groupSubtotal(thisShopGroup))} more from {shop.name} to meet its minimum order
          of {rupees(shop.minOrder)}.
        </ErrorNote>
      ) : null}
    </div>
  );
}
