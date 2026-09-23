import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MapView from '../../components/MapView';
import { AddressForm } from '../../components/LocationPicker';
import { PaymentPicker } from '../../components/OrderPieces';
import { EmptyState, ErrorNote, Field, SectionHeading, Skeleton } from '../../components/ui';
import { useConfig, usePlaceOrder, useProfile, useQuote } from '../../lib/queries';
import { rupees } from '../../lib/format';
import { cartSubtotal, useCart } from '../../store/cart';
import { useLocation } from '../../store/location';
import { useAuth } from '../../store/auth';
import type { PaymentMethod } from '../../lib/types';

const TIPS = [0, 50, 100, 200];

export default function Checkout() {
  const { groups, usePoints, setUsePoints, setTip, setPromo, markOrdered } = useCart();
  const { point, setFromAddress } = useLocation();
  const user = useAuth((state) => state.user);
  const profile = useProfile();
  const config = useConfig();
  const placeOrder = usePlaceOrder();
  const navigate = useNavigate();

  const [addressId, setAddressId] = useState<string | null>(() => point.addressId ?? null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>('COD');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const savedAddresses = profile.data?.addresses ?? [];
  const chosenAddress = savedAddresses.find((address) => address.id === addressId) ?? null;

  const quoteInput = useMemo(
    () => ({
      groups: groups.map((group) => ({
        shopId: group.shopId,
        items: group.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          note: line.note ?? undefined,
        })),
        promoCode: group.promoCode ?? null,
        tip: group.tip ?? 0,
      })),
      addressId,
      address:
        !addressId && point.source === 'gps'
          ? {
              label: point.label,
              line1: point.line1,
              area: point.area ?? 'Abbottabad',
              city: 'Abbottabad',
              lat: point.lat,
              lng: point.lng,
            }
          : null,
      usePoints,
      enabled: groups.length > 0 && Boolean(addressId || point.source === 'gps'),
    }),
    [groups, addressId, point, usePoints],
  );

  const quote = useQuote(quoteInput);
  const summary = quote.data?.summary;
  const payable = quote.data?.points.payable ?? summary?.total ?? cartSubtotal(groups);

  if (!groups.length) {
    return (
      <EmptyState
        title="Nothing to check out"
        body="Add a few items from a shop nearby and come back."
        action={
          <Link to="/home" className="btn btn-primary">
            Browse shops
          </Link>
        }
      />
    );
  }

  const submit = async () => {
    setError(null);
    try {
      const result = await placeOrder.mutateAsync({
        groups: groups.map((group) => ({
          shopId: group.shopId,
          items: group.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            note: line.note ?? undefined,
          })),
          note: group.note ?? undefined,
          promoCode: group.promoCode ?? undefined,
          tip: group.tip ?? 0,
        })),
        addressId: addressId ?? undefined,
        address: addressId
          ? undefined
          : {
              label: point.label,
              line1: point.line1,
              area: point.area ?? 'Abbottabad',
              city: 'Abbottabad',
              lat: point.lat,
              lng: point.lng,
            },
        paymentMethod: payment,
        usePoints: quote.data?.points.applied ?? usePoints,
        notes: notes || undefined,
      });
      const first = result.orders[0];
      markOrdered(first?.id ?? '');
      toast.success('Order placed — the shop is confirming now');
      navigate(first ? `/orders/${first.id}` : '/orders');
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  return (
    <div className="space-y-5 pb-32">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Checkout</h1>
        <p className="text-sm text-ink-500">
          {groups.length} {groups.length === 1 ? 'shop' : 'shops'} · one order per shop, tracked together
        </p>
      </div>

      {/* address ---------------------------------------------------------- */}
      <section className="card p-4">
        <SectionHeading
          title="Delivery address"
          subtitle={chosenAddress ? `${chosenAddress.line1}, ${chosenAddress.area ?? ''}` : `Pinned at ${point.line1}`}
          action={
            <button type="button" className="btn btn-quiet text-xs" onClick={() => setAddingAddress((open) => !open)}>
              {addingAddress ? 'Close' : 'Add new'}
            </button>
          }
        />

        {profile.isLoading ? <Skeleton className="h-14 w-full" /> : null}

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setAddressId(null)}
            className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left ${
              !addressId ? 'border-forest-400 bg-forest-50' : 'border-cream-300 bg-cream-50'
            }`}
          >
            <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-xl bg-clay-500 text-xs font-bold text-cream-50">
              GPS
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-forest-800">{point.label}</span>
              <span className="block truncate text-xs text-ink-500">{point.line1}</span>
            </span>
          </button>

          {savedAddresses.map((address) => (
            <button
              key={address.id}
              type="button"
              onClick={() => setAddressId(address.id)}
              className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left ${
                addressId === address.id ? 'border-forest-400 bg-forest-50' : 'border-cream-300 bg-cream-50'
              }`}
            >
              <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-xl bg-forest-600 text-xs font-bold text-cream-50">
                {address.label.slice(0, 1)}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-forest-800">{address.label}</span>
                <span className="block truncate text-xs text-ink-500">
                  {address.line1}
                  {address.area ? `, ${address.area}` : ''}
                </span>
                {address.instructions ? (
                  <span className="block truncate text-xs text-ink-500">“{address.instructions}”</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>

        {addingAddress ? (
          <div className="mt-3">
            <AddressForm
              defaultCenter={{ lat: point.lat, lng: point.lng }}
              onDone={(address) => {
                setAddressId(address.id);
                setFromAddress(address);
                setAddingAddress(false);
                void profile.refetch();
              }}
              onCancel={() => setAddingAddress(false)}
            />
          </div>
        ) : null}

        <div className="mt-3">
          <MapView
            center={[chosenAddress?.lat ?? point.lat, chosenAddress?.lng ?? point.lng]}
            zoom={14}
            height="11rem"
            markers={[
              {
                id: 'drop',
                lat: chosenAddress?.lat ?? point.lat,
                lng: chosenAddress?.lng ?? point.lng,
                label: 'Delivery address',
                kind: 'home',
              },
            ]}
          />
        </div>
      </section>

      {/* per-shop baskets ------------------------------------------------- */}
      {quote.isLoading ? <Skeleton className="h-40 w-full" /> : null}

      {quote.data?.groups.map((group) => (
        <section key={group.shopId} className="card p-4">
          <SectionHeading
            title={group.shop.name}
            subtitle={`${group.etaMinutes} min · ${group.distanceKm} km${group.zoneName ? ` · ${group.zoneName}` : ''}`}
          />

          {!group.deliverable ? (
            <ErrorNote>{group.shop.name} does not deliver to this address yet.</ErrorNote>
          ) : null}
          {group.warnings.map((warning) => (
            <p key={warning} className="mb-1 text-xs font-semibold text-clay-600">
              {warning}
            </p>
          ))}
          {group.promoError ? <ErrorNote>{group.promoError}</ErrorNote> : null}

          <ul className="divide-y divide-cream-200">
            {group.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                <span className="min-w-0 truncate text-ink-900">
                  {item.quantity} × {item.name}
                  <span className="text-ink-500"> ({item.unit})</span>
                </span>
                <span className="font-semibold tabular-nums">{rupees(item.total)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-1.5 rounded-2xl bg-cream-100 p-3 text-sm">
            <Row label="Subtotal" value={rupees(group.subtotal)} />
            <Row
              label="Delivery"
              value={group.deliveryFee ? rupees(group.deliveryFee) : 'Free'}
            />
            <Row label="Service fee" value={rupees(group.serviceFee)} />
            {group.discount ? <Row label="Discount" value={`− ${rupees(group.discount)}`} /> : null}
            {group.tip ? <Row label="Tip" value={rupees(group.tip)} /> : null}
            <div className="row-divider flex items-center justify-between pt-2 font-bold text-forest-800">
              <span>Shop total</span>
              <span>{rupees(group.total)}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="label">Tip the rider</span>
            {TIPS.map((amount) => (
              <button
                key={amount}
                type="button"
                className={`chip ${(groups.find((entry) => entry.shopId === group.shopId)?.tip ?? 0) === amount ? 'chip-active' : ''}`}
                onClick={() => setTip(group.shopId, amount)}
              >
                {amount === 0 ? 'None' : rupees(amount)}
              </button>
            ))}
            <button
              type="button"
              className="chip"
              onClick={() => {
                setPromo(group.shopId, null);
                toast.success(`Promo removed from ${group.shop.name}`);
              }}
            >
              Clear promo
            </button>
          </div>
        </section>
      ))}

      {/* payment ---------------------------------------------------------- */}
      <section className="card space-y-4 p-4">
        <SectionHeading
          title="Payment"
          subtitle={`Wallet balance ${user?.walletPoints ?? 0} points${
            config.data?.payments.mode === 'sandbox' ? ' · gateways in sandbox' : ''
          }`}
        />

        {quote.data && quote.data.points.maxRedeemable > 0 ? (
          <div className="rounded-2xl border border-forest-100 bg-forest-50 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-forest-700">Use points</span>
              <span className="font-bold text-forest-700">
                {quote.data.points.applied} / {quote.data.points.maxRedeemable}
              </span>
            </div>
            <input
              type="range"
              className="mt-2 w-full accent-forest-600"
              min={0}
              max={quote.data.points.maxRedeemable}
              step={10}
              value={usePoints}
              onChange={(event) => setUsePoints(Number(event.target.value))}
            />
            <p className="mt-1 text-xs text-ink-500">
              1 point = Re 1 off. Paying {rupees(quote.data.points.payable)} after points.
            </p>
          </div>
        ) : null}

        <PaymentPicker
          value={payment}
          onChange={setPayment}
          availablePoints={user?.walletPoints ?? 0}
          total={summary?.total ?? 0}
        />

        <Field label="Notes for the shops and rider" hint="Gate colour, landmark, call on arrival — anything useful">
          <textarea
            className="input min-h-20"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            placeholder="Please call when you reach the green gate."
          />
        </Field>
      </section>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="fixed inset-x-0 bottom-[4.6rem] z-40 px-4 lg:bottom-4">
        <div className="card mx-auto flex max-w-2xl items-center gap-3 border-forest-200 p-3.5 shadow-lg">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-500">
              {summary ? `${rupees(summary.subtotal)} items + ${rupees(summary.deliveryFee)} delivery + ${rupees(summary.serviceFee)} fee` : 'Calculating…'}
            </p>
            <p className="text-lg font-bold text-forest-800">{rupees(payable)}</p>
          </div>
          <button
            type="button"
            className="btn btn-primary px-5 py-3"
            disabled={placeOrder.isPending || !quote.data || !quote.data.groups.every((group) => group.deliverable)}
            onClick={submit}
          >
            {placeOrder.isPending ? 'Placing…' : 'Place order'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}
