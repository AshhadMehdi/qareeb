import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, Field, Modal, SectionHeading, Skeleton, Tag } from '../../components/ui';
import { useDeleteProduct, useMerchantOverview, useSaveProduct, useSetStock } from '../../lib/queries';
import { rupees } from '../../lib/format';
import type { Product } from '../../lib/types';

type Draft = {
  id?: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  emoji: string;
  description: string;
  isAvailable: boolean;
  isFeatured: boolean;
};

const emptyDraft: Draft = {
  name: '',
  category: 'General',
  unit: 'piece',
  price: 100,
  compareAtPrice: null,
  stock: 10,
  emoji: '',
  description: '',
  isAvailable: true,
  isFeatured: false,
};

export default function MerchantProducts() {
  const shop = useMerchantOverview();
  const save = useSaveProduct();
  const setStock = useSetStock();
  const remove = useDeleteProduct();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState('');

  const products = shop.data?.products ?? [];
  const categories = [...new Set(products.map((product) => product.category))];
  const filtered = products.filter((product) =>
    search ? product.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  if (shop.isLoading) return <Skeleton className="h-40 w-full" />;
  if (shop.isError || !shop.data) {
    return <EmptyState title="Set up your shop first" body="Add your shop details to start listing products." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-forest-800">Products</h1>
          <p className="text-sm text-ink-500">
            {products.length} items · {shop.data.products.filter((product) => product.stock === 0).length} out of stock
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className="input max-w-48"
            placeholder="Search catalogue"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" className="btn btn-primary text-xs" onClick={() => setDraft({ ...emptyDraft })}>
            Add product
          </button>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="hidden grid-cols-[2.4fr_1fr_1fr_1.4fr_1.2fr] gap-3 border-b border-cream-200 bg-cream-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-500 lg:grid">
          <span>Item</span>
          <span>Price</span>
          <span>Unit</span>
          <span>Stock</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-cream-200">
          {filtered.map((product) => (
            <ProductLine
              key={product.id}
              product={product}
              onStock={(delta) =>
                setStock.mutateAsync({ id: product.id, delta }).catch((error: Error) => toast.error(error.message))
              }
              onEdit={() =>
                setDraft({
                  id: product.id,
                  name: product.name,
                  category: product.category,
                  unit: product.unit,
                  price: product.price,
                  compareAtPrice: product.compareAtPrice,
                  stock: product.stock,
                  emoji: product.emoji ?? '',
                  description: product.description ?? '',
                  isAvailable: product.isAvailable,
                  isFeatured: product.isFeatured,
                })
              }
              onDelete={async () => {
                try {
                  await remove.mutateAsync(product.id);
                  toast.success('Product removed');
                } catch (error) {
                  toast.error((error as Error).message);
                }
              }}
            />
          ))}
        </div>
        {!filtered.length ? (
          <EmptyState compact title="No products yet" body="Add your first item — the catalogue is what customers browse." />
        ) : null}
      </section>

      <section className="card p-4">
        <SectionHeading title="Categories in use" subtitle="Group items so customers can jump between sections" />
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Tag key={category}>{category}</Tag>
          ))}
          {!categories.length ? <p className="text-sm text-ink-500">Categories appear once you add products.</p> : null}
        </div>
      </section>

      <Modal open={Boolean(draft)} title={draft?.id ? 'Edit product' : 'New product'} onClose={() => setDraft(null)} wide>
        {draft ? (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await save.mutateAsync({
                  id: draft.id,
                  name: draft.name,
                  category: draft.category,
                  unit: draft.unit,
                  price: Number(draft.price),
                  compareAtPrice: draft.compareAtPrice ? Number(draft.compareAtPrice) : null,
                  stock: Number(draft.stock),
                  emoji: draft.emoji || null,
                  description: draft.description || null,
                  isAvailable: draft.isAvailable,
                  isFeatured: draft.isFeatured,
                });
                toast.success(draft.id ? 'Product updated' : 'Product added');
                setDraft(null);
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            <div className="sm:col-span-2">
              <Field label="Name">
                <input
                  className="input"
                  value={draft.name}
                  required
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Category">
              <input
                className="input"
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                list="qareeb-merchant-categories"
              />
              <datalist id="qareeb-merchant-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </Field>
            <Field label="Unit">
              <input
                className="input"
                value={draft.unit}
                onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
                placeholder="1 kg / dozen / piece"
              />
            </Field>
            <Field label="Price (PKR)">
              <input
                className="input"
                type="number"
                min={1}
                value={draft.price}
                onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })}
              />
            </Field>
            <Field label="Compare-at price" hint="Shows a strikethrough saving">
              <input
                className="input"
                type="number"
                min={0}
                value={draft.compareAtPrice ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, compareAtPrice: event.target.value ? Number(event.target.value) : null })
                }
              />
            </Field>
            <Field label="Stock">
              <input
                className="input"
                type="number"
                min={0}
                value={draft.stock}
                onChange={(event) => setDraft({ ...draft, stock: Number(event.target.value) })}
              />
            </Field>
            <Field label="Icon" hint="Two letters or a short word, no emoji faces">
              <input
                className="input"
                value={draft.emoji}
                maxLength={8}
                onChange={(event) => setDraft({ ...draft, emoji: event.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea
                  className="input min-h-20"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-forest-600"
                checked={draft.isAvailable}
                onChange={(event) => setDraft({ ...draft, isAvailable: event.target.checked })}
              />
              Available to order
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-forest-600"
                checked={draft.isFeatured}
                onChange={(event) => setDraft({ ...draft, isFeatured: event.target.checked })}
              />
              Feature on the shop page
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="btn btn-primary flex-1" disabled={save.isPending}>
                {draft.id ? 'Save changes' : 'Add product'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

function ProductLine({
  product,
  onStock,
  onEdit,
  onDelete,
}: {
  product: Product;
  onStock: (delta: number) => Promise<unknown>;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-3 px-4 py-3 lg:grid-cols-[2.4fr_1fr_1fr_1.4fr_1.2fr] lg:items-center">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream-200 text-xs font-semibold text-forest-700">
          {product.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{product.name}</p>
          <p className="text-xs text-ink-500">{product.category}</p>
        </div>
      </div>
      <p className="text-sm font-semibold text-ink-900">{rupees(product.price)}</p>
      <p className="text-xs text-ink-500">{product.unit}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-quiet px-2.5 py-1 text-xs"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onStock(-1);
            setBusy(false);
          }}
        >
          −
        </button>
        <span
          className={`min-w-10 text-center text-sm font-bold ${
            product.stock === 0 ? 'text-clay-600' : product.stock <= 5 ? 'text-wheat-500' : 'text-forest-700'
          }`}
        >
          {product.stock}
        </span>
        <button
          type="button"
          className="btn btn-quiet px-2.5 py-1 text-xs"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onStock(10);
            setBusy(false);
          }}
        >
          +
        </button>
        {!product.isAvailable ? <Tag tone="clay">Hidden</Tag> : null}
      </div>
      <div className="flex gap-2 lg:justify-end">
        <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={onEdit}>
          Edit
        </button>
        <button
          type="button"
          className="btn btn-quiet px-3 py-1.5 text-xs"
          onClick={() => {
            void onDelete();
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
