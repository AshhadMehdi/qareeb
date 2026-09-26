import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, SectionHeading, Skeleton, Tag } from '../../components/ui';
import { useAdminMutations, useAdminShops } from '../../lib/queries';
import { rupees } from '../../lib/format';

const FILTERS = ['ALL', 'PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED'];

export default function AdminShops() {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const shops = useAdminShops(filter);
  const { setShopStatus } = useAdminMutations();

  const list = (shops.data?.shops ?? []).filter((shop) =>
    search
      ? `${shop.name} ${shop.ownerEmail ?? ''} ${shop.category}`.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-forest-800">Shops</h1>
          <p className="text-sm text-ink-500">
            {(shops.data?.counts ?? []).map((entry) => `${entry.count} ${entry.status.toLowerCase()}`).join(' · ') ||
              'No shops yet'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input max-w-52"
            placeholder="Search shops or owners"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip ${filter === option ? 'chip-active' : ''}`}
              onClick={() => setFilter(option)}
            >
              {option.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {shops.isLoading ? <Skeleton className="h-40 w-full" /> : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((shop) => (
          <article key={shop.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-forest-800">{shop.name}</p>
                <p className="text-xs text-ink-500">
                  {shop.category} · {shop.addressLine}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  {shop.ownerName ?? 'Owner'} · {shop.ownerEmail ?? 'no email'}
                </p>
              </div>
              <Tag tone={shop.status === 'APPROVED' ? 'forest' : shop.status === 'SUSPENDED' ? 'clay' : 'cream'}>
                {(shop.status ?? 'PENDING').toLowerCase()}
              </Tag>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Tag>{shop.products} products</Tag>
              <Tag>{shop.zones} rings</Tag>
              <Tag>★ {shop.ratingAvg.toFixed(1)}</Tag>
              <Tag>{shop.isOpen && !shop.isPaused ? 'accepting orders' : 'paused'}</Tag>
              <Tag>{shop.deliveryMode?.replace('_', ' ').toLowerCase()}</Tag>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {shop.status !== 'APPROVED' ? (
                <button
                  type="button"
                  className="btn btn-primary px-3 py-2 text-xs"
                  disabled={setShopStatus.isPending}
                  onClick={async () => {
                    try {
                      await setShopStatus.mutateAsync({ id: shop.id, status: 'APPROVED' });
                      toast.success(`${shop.name} is live`);
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  Approve
                </button>
              ) : null}
              {shop.status !== 'SUSPENDED' ? (
                <button
                  type="button"
                  className="btn btn-quiet px-3 py-2 text-xs"
                  disabled={setShopStatus.isPending}
                  onClick={async () => {
                    const reason = window.prompt('Reason for suspending this shop?') ?? undefined;
                    if (reason === undefined) return;
                    try {
                      await setShopStatus.mutateAsync({ id: shop.id, status: 'SUSPENDED', reason });
                      toast.success(`${shop.name} suspended`);
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  Suspend
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost px-3 py-2 text-xs"
                  onClick={async () => {
                    try {
                      await setShopStatus.mutateAsync({ id: shop.id, status: 'APPROVED' });
                      toast.success(`${shop.name} reinstated`);
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  Reinstate
                </button>
              )}
              <a className="btn btn-ghost px-3 py-2 text-xs" href={`/shop/${shop.slug}`} target="_blank" rel="noreferrer">
                View storefront
              </a>
            </div>
          </article>
        ))}
      </div>

      {!shops.isLoading && !list.length ? (
        <EmptyState title="No shops in this view" body="Approve new sign-ups or clear the search filter." />
      ) : null}

      <section className="card p-4">
        <SectionHeading title="Commission snapshot" subtitle="Platform take on delivered orders (14 days)" />
        <p className="text-sm text-ink-500">
          Commission and service-fee percentages are configured in{' '}
          <a href="/admin/settings" className="font-semibold text-forest-600">
            platform settings
          </a>
          . Individual shops can be given a custom rate from the API when needed.
        </p>
        <p className="mt-2 text-sm text-ink-700">
          Order value shown to customers includes the {rupees(60)} base delivery fee per ring.
        </p>
      </section>
    </div>
  );
}
