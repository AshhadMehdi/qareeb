import { useEffect, useState } from 'react';
import { ProductSearchCard, ShopCard } from '../../components/cards';
import { EmptyState, SectionHeading, Skeleton } from '../../components/ui';
import { IconSearch } from '../../components/icons';
import { useSearch } from '../../lib/queries';
import { useLocation } from '../../store/location';

const SUGGESTIONS = ['milk', 'sabzi', 'chicken', 'atta', 'medicine', 'cake', 'panadol'];

export default function Search() {
  const point = useLocation((state) => state.point);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  const search = useSearch(debounced, point);
  const products = search.data?.products ?? [];
  const shops = search.data?.shops ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Search</h1>
        <p className="text-sm text-ink-500">Products and shops across {point.area ?? 'Abbottabad'}.</p>
      </div>

      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
        <input
          className="input pl-9"
          value={term}
          autoFocus
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Try “milk”, “chicken” or “Panadol”"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} type="button" className="chip" onClick={() => setTerm(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      {search.isFetching ? <Skeleton className="h-20 w-full" /> : null}

      {debounced.length >= 2 && !search.isFetching && !products.length && !shops.length ? (
        <EmptyState
          title={`Nothing found for “${debounced}”`}
          body="Check the spelling, or browse the shops around you — new stock is added daily."
        />
      ) : null}

      {shops.length ? (
        <section>
          <SectionHeading title="Shops" subtitle={`${shops.length} matching`} />
          <div className="grid gap-3 sm:grid-cols-2">
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        </section>
      ) : null}

      {products.length ? (
        <section>
          <SectionHeading title="Products" subtitle={`${products.length} matching`} />
          <div className="space-y-2">
            {products.map((hit) => (
              <ProductSearchCard key={`${hit.shop.id}-${hit.id}`} hit={hit} />
            ))}
          </div>
        </section>
      ) : null}

      {debounced.length < 2 ? (
        <EmptyState
          title="What are you looking for?"
          body="Type at least two letters. Qareeb searches every shop's catalogue at once."
        />
      ) : null}
    </div>
  );
}
