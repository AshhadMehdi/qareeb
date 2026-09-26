import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import MapView, { type MapMarker } from '../../components/MapView';
import { ChatPanel, OrderTimeline, PaymentSummary } from '../../components/OrderPieces';
import { EmptyState, ErrorNote, SectionHeading, Skeleton, StatusPill } from '../../components/ui';
import { IconChat, IconPin } from '../../components/icons';
import { useCancelOrder, useOrder, useReviewOrder, useSendMessage } from '../../lib/queries';
import { PAYMENT_LABELS, initials, rupees } from '../../lib/format';
import { useLiveRiders } from '../../lib/realtime';
import { useAuth } from '../../store/auth';

export default function OrderTracking() {
  const { id } = useParams<{ id: string }>();
  const user = useAuth((state) => state.user);
  const navigate = useNavigate();
  const query = useOrder(id);
  const cancel = useCancelOrder();
  const review = useReviewOrder();
  const send = useSendMessage(id);
  const livePositions = useLiveRiders((state) => state.positions);

  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [tab, setTab] = useState<'timeline' | 'chat'>('timeline');

  const order = query.data?.order;
  const runnerId = order?.runner?.id;
  const live = runnerId ? livePositions[runnerId] : undefined;

  useEffect(() => {
    if (query.data && !order?.hasReview && order?.status !== 'DELIVERED') setTab('timeline');
  }, [query.data, order?.hasReview, order?.status]);

  const riderPosition = live
    ? { lat: live.lat, lng: live.lng }
    : order?.runner?.lat != null && order?.runner?.lng != null
      ? { lat: order.runner.lat, lng: order.runner.lng }
      : null;

  const markers = useMemo(() => {
    if (!order) return [];
    const list: MapMarker[] = [
      ...(order.shop
        ? [{ id: 'shop', lat: order.shop.lat, lng: order.shop.lng, label: order.shop.name, kind: 'shop' as const }]
        : []),
      {
        id: 'drop',
        lat: order.deliveryAddress.lat,
        lng: order.deliveryAddress.lng,
        label: 'Your address',
        kind: 'home' as const,
      },
    ];
    if (riderPosition) {
      list.push({
        id: 'rider',
        lat: riderPosition.lat,
        lng: riderPosition.lng,
        label: order.runner?.name ?? 'Rider',
        kind: 'rider' as const,
      });
    }
    return list;
  }, [order, riderPosition]);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (query.isError || !order) {
    return (
      <EmptyState
        title="Order not found"
        body={(query.error as Error | null)?.message ?? 'It may have been removed.'}
        action={
          <Link to="/orders" className="btn btn-primary">
            All orders
          </Link>
        }
      />
    );
  }

  const arrivingIn = order.status === 'ON_THE_WAY' && live
    ? Math.max(3, Math.round(order.etaMinutes - (Date.now() - new Date(live.at).getTime()) / 60_000))
    : order.etaMinutes;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-forest-800">{order.shop?.name}</h1>
            <StatusPill status={order.status} />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {order.orderNumber} · {order.items.length} items · {rupees(order.total)} ·{' '}
            {PAYMENT_LABELS[order.paymentMethod]}
          </p>
        </div>
        <Link to="/orders" className="btn btn-quiet text-xs">
          All orders
        </Link>
      </div>

      {order.status === 'ON_THE_WAY' ? (
        <div className="card flex items-center gap-3 border-forest-200 bg-forest-50 p-4">
          <IconPin className="h-5 w-5 shrink-0 text-forest-600" />
          <div>
            <p className="text-sm font-bold text-forest-800">
              {order.runner?.name ?? 'Your rider'} arrives in about {arrivingIn} min
            </p>
            <p className="text-xs text-forest-600">
              {order.paymentMethod === 'COD'
                ? `Keep ${rupees(order.total)} ready in cash.`
                : 'Already paid — just collect your order.'}
            </p>
          </div>
        </div>
      ) : null}

      <MapView
        center={[order.deliveryAddress.lat, order.deliveryAddress.lng]}
        zoom={14}
        height="18rem"
        follow={order.status === 'ON_THE_WAY' && riderPosition ? [riderPosition.lat, riderPosition.lng] : null}
        path={
          order.shop && riderPosition
            ? [
                [order.shop.lat, order.shop.lng],
                [riderPosition.lat, riderPosition.lng],
                [order.deliveryAddress.lat, order.deliveryAddress.lng],
              ]
            : order.shop
              ? [
                  [order.shop.lat, order.shop.lng],
                  [order.deliveryAddress.lat, order.deliveryAddress.lng],
                ]
              : undefined
        }
        markers={markers}
      />

      {/* Where it is going — landmark first, because that is how people give directions. */}
      <div className="card flex items-start gap-3 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-700">
          <IconPin className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Delivering to</p>
          <p className="text-sm font-bold text-forest-800">
            {order.deliveryAddress.label} · {order.deliveryAddress.line1}
          </p>
          <p className="text-xs text-ink-700">
            {order.deliveryAddress.area ? `${order.deliveryAddress.area}, ` : ''}
            {order.deliveryAddress.city}
          </p>
          {order.deliveryAddress.instructions ? (
            <p className="mt-1 text-xs italic text-ink-500">{order.deliveryAddress.instructions}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="card p-4">
          <SectionHeading
            title="Progress"
            subtitle={order.status === 'DELIVERED' ? 'Delivered — enjoy' : `Estimated ${order.etaMinutes} minutes`}
          />
          <OrderTimeline order={order} />

          {order.runner ? (
            <div className="mt-4 rounded-2xl border border-cream-300 bg-cream-50 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest-800 text-sm font-bold text-gold-200">
                    {initials(order.runner.name)}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-forest-800">{order.runner.name}</p>
                    <p className="text-xs text-ink-500">Your rider</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {order.runner.phone ? (
                    <a className="btn btn-ghost px-3 py-2 text-xs" href={`tel:${order.runner.phone.replace(/\s/g, '')}`}>
                      Call
                    </a>
                  ) : null}
                  {order.runner.phone ? (
                    <a
                      className="btn btn-ghost px-3 py-2 text-xs"
                      href={`https://wa.me/${order.runner.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  ) : null}
                  <button type="button" className="btn btn-primary px-3 py-2 text-xs" onClick={() => setTab('chat')}>
                    <IconChat className="h-3.5 w-3.5" /> Chat
                  </button>
                </div>
              </div>
              {order.status === 'ON_THE_WAY' && !live ? (
                <p className="mt-2 text-xs text-ink-500">
                  Waiting for the rider's next GPS ping — positions refresh every few seconds.
                </p>
              ) : null}
            </div>
          ) : null}

          {query.data?.canCancel ? (
            <div className="mt-4">
              {cancelling ? (
                <div className="space-y-2">
                  <input
                    className="input"
                    placeholder="Reason for cancelling (optional)"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={200}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-quiet flex-1"
                      disabled={cancel.isPending}
                      onClick={async () => {
                        try {
                          await cancel.mutateAsync({ id: order.id, reason: reason || undefined });
                          toast.success('Order cancelled and any payment refunded');
                          setCancelling(false);
                          void query.refetch();
                        } catch (error) {
                          toast.error((error as Error).message);
                        }
                      }}
                    >
                      Confirm cancellation
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setCancelling(false)}>
                      Keep order
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost w-full" onClick={() => setCancelling(true)}>
                  Cancel this order
                </button>
              )}
            </div>
          ) : null}
        </section>

        <section className="card p-4">
          <div className="mb-3 flex gap-2">
            {(['timeline', 'chat'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`chip ${tab === mode ? 'chip-active' : ''}`}
                onClick={() => setTab(mode)}
              >
                {mode === 'timeline' ? 'Order details' : 'Chat'}
              </button>
            ))}
          </div>

          {tab === 'timeline' ? (
            <div className="space-y-4">
              <div>
                <p className="label">Delivering to</p>
                <p className="mt-1 text-sm font-semibold text-ink-900">
                  {order.deliveryAddress.label} · {order.deliveryAddress.line1}
                </p>
                <p className="text-xs text-ink-500">
                  {order.deliveryAddress.area}
                  {order.deliveryAddress.instructions ? ` · “${order.deliveryAddress.instructions}”` : ''}
                </p>
              </div>

              <div>
                <p className="label">Items</p>
                <ul className="mt-1 divide-y divide-cream-200">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="min-w-0 truncate">
                        {item.quantity} × {item.name}
                        {item.note ? <span className="text-ink-500"> · {item.note}</span> : null}
                      </span>
                      <span className="tabular-nums">{rupees(item.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <PaymentSummary order={order} />

              {order.notes ? (
                <p className="rounded-2xl bg-cream-100 p-3 text-xs text-ink-700">“{order.notes}”</p>
              ) : null}

              {query.data && query.data.group.length > 1 ? (
                <div>
                  <p className="label">Same checkout</p>
                  <div className="mt-1 space-y-1">
                    {query.data.group
                      .filter((sibling) => sibling.id !== order.id)
                      .map((sibling) => (
                        <Link
                          key={sibling.id}
                          to={`/orders/${sibling.id}`}
                          className="flex items-center justify-between rounded-xl border border-cream-200 px-3 py-2 text-xs"
                        >
                          <span className="font-semibold text-forest-700">{sibling.shop?.name}</span>
                          <StatusPill status={sibling.status} />
                        </Link>
                      ))}
                  </div>
                </div>
              ) : null}

              {order.status === 'DELIVERED' && !order.hasReview ? (
                <div className="rounded-2xl border border-cream-200 bg-cream-100 p-3">
                  <p className="text-sm font-bold text-forest-800">Rate {order.shop?.name}</p>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-label={`${value} stars`}
                        className={`text-xl ${value <= rating ? 'text-wheat-500' : 'text-cream-400'}`}
                        onClick={() => setRating(value)}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <input
                    className="input mt-2"
                    placeholder="Anything the shop or rider should know?"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary mt-2 w-full"
                    disabled={review.isPending}
                    onClick={async () => {
                      try {
                        await review.mutateAsync({
                          id: order.id,
                          shopRating: rating,
                          runnerRating: order.runner ? rating : undefined,
                          comment: comment || undefined,
                        });
                        toast.success('Rating saved');
                        void query.refetch();
                      } catch (error) {
                        toast.error((error as Error).message);
                      }
                    }}
                  >
                    Submit rating
                  </button>
                </div>
              ) : null}

              {query.data?.review ? (
                <p className="text-xs text-forest-600">
                  You rated this order {query.data.review.shopRating}/5.
                </p>
              ) : null}
            </div>
          ) : (
            <ChatPanel
              order={order}
              messages={query.data?.messages ?? []}
              currentUserId={user?.id ?? ''}
              sending={send.isPending}
              onSend={async (body) => {
                try {
                  await send.mutateAsync(body);
                } catch (error) {
                  toast.error((error as Error).message);
                }
              }}
            />
          )}

          {order.status === 'CANCELLED' ? <ErrorNote>{order.cancelReason}</ErrorNote> : null}

          <button
            type="button"
            className="btn btn-ghost mt-4 w-full"
            onClick={() => navigate(`/shop/${order.shop?.slug}`)}
          >
            Order from {order.shop?.name} again
          </button>
        </section>
      </div>
    </div>
  );
}
