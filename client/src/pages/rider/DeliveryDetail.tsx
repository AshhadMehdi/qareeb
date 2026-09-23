import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import MapView from '../../components/MapView';
import { ChatPanel, OrderTimeline } from '../../components/OrderPieces';
import { EmptyState, ErrorNote, SectionHeading, Skeleton, StatusPill } from '../../components/ui';
import { useOrder, useRunnerMutations } from '../../lib/queries';
import { apiPost } from '../../lib/api';
import { PAYMENT_LABELS, distance, rupees } from '../../lib/format';
import { useAuth } from '../../store/auth';
import type { Order } from '../../lib/types';

const NAV = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export default function RiderDeliveryDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useAuth((state) => state.user);
  const query = useOrder(id);
  const navigate = useNavigate();
  const { setStatus, decline, simulate, pushLocation } = useRunnerMutations();

  const [simulating, setSimulating] = useState(false);
  const [messages, setMessages] = useState<{ id: string; senderId: string; senderRole: string; body: string; createdAt: string }[]>([]);
  const [sending, setSending] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  if (query.isLoading) return <Skeleton className="h-40 w-full" />;
  if (query.isError || !query.data) {
    return <EmptyState title="Delivery not found" body="It may have been reassigned to another rider." />;
  }

  const { order } = query.data;
  const shop = order.shop;
  const cashDue = order.paymentMethod === 'COD' ? order.total : 0;

  const startSimulation = async () => {
    try {
      const route = await simulate.mutateAsync(order.id);
      setSimulating(true);
      toast.success(`Simulating the ride — ${route.distanceKm} km, ${route.waypoints.length} GPS pings`);
      let index = 0;
      timer.current = window.setInterval(async () => {
        const point = route.waypoints[index];
        if (!point) {
          if (timer.current) window.clearInterval(timer.current);
          setSimulating(false);
          return;
        }
        const next = route.waypoints[index + 1];
        const heading = next
          ? (Math.atan2(next.lng - point.lng, next.lat - point.lat) * 180) / Math.PI
          : null;
        await pushLocation.mutateAsync({ lat: point.lat, lng: point.lng, heading, orderId: order.id }).catch(() => undefined);
        index += 1;
      }, route.stepSeconds * 1000);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-forest-800">{order.orderNumber}</h1>
            <StatusPill status={order.status} />
          </div>
          <p className="text-xs text-ink-500">
            {distance(order.distanceKm)} · {order.items.length} items · {PAYMENT_LABELS[order.paymentMethod]}
          </p>
        </div>
        <button type="button" className="btn btn-quiet text-xs" onClick={() => navigate('/rider')}>
          Back to queue
        </button>
      </div>

      {cashDue > 0 && order.status !== 'DELIVERED' ? (
        <div className="card border-clay-100 bg-clay-100/60 p-4">
          <p className="text-sm font-bold text-clay-600">Collect {rupees(cashDue)} in cash</p>
          <p className="text-xs text-ink-700">Count it before you leave, and keep it safe until the shop settles.</p>
        </div>
      ) : null}

      <MapView
        center={[shop?.lat ?? order.deliveryAddress.lat, shop?.lng ?? order.deliveryAddress.lng]}
        zoom={14}
        height="16rem"
        markers={[
          ...(shop ? [{ id: 'shop', lat: shop.lat, lng: shop.lng, label: shop.name, kind: 'shop' as const }] : []),
          {
            id: 'drop',
            lat: order.deliveryAddress.lat,
            lng: order.deliveryAddress.lng,
            label: 'Drop-off',
            kind: 'destination' as const,
          },
          ...(order.runner?.lat != null && order.runner?.lng != null
            ? [{ id: 'me', lat: order.runner.lat, lng: order.runner.lng, label: 'You', kind: 'rider' as const }]
            : []),
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-4">
          <SectionHeading title="Pickup" subtitle={shop?.addressLine ?? ''} />
          <div className="flex flex-wrap gap-2">
            {shop ? (
              <a className="btn btn-ghost px-3 py-2 text-xs" href={NAV(shop.lat, shop.lng)} target="_blank" rel="noreferrer">
                Navigate to shop
              </a>
            ) : null}
            {shop?.phone ? (
              <a className="btn btn-ghost px-3 py-2 text-xs" href={`tel:${shop.phone.replace(/\s/g, '')}`}>
                Call shop
              </a>
            ) : null}
          </div>

          <div className="rounded-2xl bg-cream-100 p-3">
            <p className="label">Order contents</p>
            <ul className="mt-1 space-y-1 text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-ink-700">
                    {item.quantity} × {item.name}
                  </span>
                  <span className="tabular-nums text-ink-900">{rupees(item.total)}</span>
                </li>
              ))}
            </ul>
          </div>

          <SectionHeading title="Drop-off" subtitle={`${order.deliveryAddress.label} · ${order.deliveryAddress.area ?? ''}`} />
          <p className="text-sm text-ink-700">{order.deliveryAddress.line1}</p>
          {order.deliveryAddress.instructions ? (
            <p className="text-xs text-ink-500">“{order.deliveryAddress.instructions}”</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <a
              className="btn btn-primary px-3 py-2 text-xs"
              href={NAV(order.deliveryAddress.lat, order.deliveryAddress.lng)}
              target="_blank"
              rel="noreferrer"
            >
              Navigate to customer
            </a>
            <a
              className="btn btn-ghost px-3 py-2 text-xs"
              href={`tel:${(order.customer?.phone ?? order.deliveryAddress.phone ?? '').replace(/\s/g, '')}`}
            >
              Call customer
            </a>
            {order.customer?.phone ? (
              <a
                className="btn btn-ghost px-3 py-2 text-xs"
                href={`https://wa.me/${order.customer.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-cream-200 pt-3">
            {['ACCEPTED', 'PREPARING', 'READY'].includes(order.status) ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary px-3 py-2 text-xs"
                  disabled={setStatus.isPending}
                  onClick={async () => {
                    try {
                      await setStatus.mutateAsync({ id: order.id, status: 'ON_THE_WAY' });
                      toast.success('Picked up — customer can watch you live');
                      void query.refetch();
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  I have picked it up
                </button>
                <button
                  type="button"
                  className="btn btn-quiet px-3 py-2 text-xs"
                  disabled={decline.isPending}
                  onClick={async () => {
                    try {
                      await decline.mutateAsync(order.id);
                      toast.success('Delivery declined — the shop will reassign');
                      navigate('/rider');
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  Decline
                </button>
              </>
            ) : null}

            {order.status === 'ON_THE_WAY' ? (
              <button
                type="button"
                className="btn btn-primary px-3 py-2 text-xs"
                disabled={setStatus.isPending}
                onClick={async () => {
                  try {
                    await setStatus.mutateAsync({ id: order.id, status: 'DELIVERED', cashCollected: cashDue || undefined });
                    toast.success('Delivered — thanks');
                    void query.refetch();
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                Mark as delivered
              </button>
            ) : null}

            {!['DELIVERED', 'CANCELLED'].includes(order.status) ? (
              <button
                type="button"
                className={`btn ${simulating ? 'btn-quiet' : 'btn-ghost'} px-3 py-2 text-xs`}
                disabled={simulating || simulate.isPending}
                onClick={() => {
                  if (simulating && timer.current) {
                    window.clearInterval(timer.current);
                    setSimulating(false);
                    return;
                  }
                  void startSimulation();
                }}
              >
                {simulating ? 'Stop simulated ride' : 'Simulate ride (demo)'}
              </button>
            ) : null}
          </div>

          {simulating ? (
            <p className="text-xs text-forest-600">
              Sending GPS pings every few seconds — the customer's map is following you.
            </p>
          ) : null}

          {order.status === 'DELIVERED' ? (
            <p className="rounded-2xl bg-forest-50 p-3 text-sm text-forest-700">
              Delivered. You earned {rupees(order.deliveryFee + order.tip)} on this trip.
            </p>
          ) : null}
        </section>

        <section className="card space-y-4 p-4">
          <SectionHeading title="Trip progress" />
          <OrderTimeline order={order} />

          <div className="border-t border-cream-200 pt-3">
            <ChatPanel
              order={order}
              messages={messages.length ? messages : query.data.messages}
              currentUserId={user?.id ?? ''}
              sending={sending}
              onSend={async (body) => {
                setSending(true);
                try {
                  const result = await apiPost<{ message: (typeof messages)[number] }>(`/orders/${order.id}/messages`, {
                    body,
                  });
                  setMessages((current) => [...current, result.message]);
                } catch (error) {
                  toast.error((error as Error).message);
                } finally {
                  setSending(false);
                }
              }}
            />
          </div>

          <Link to="/rider" className="btn btn-ghost w-full text-xs">
            Back to all deliveries
          </Link>
        </section>
      </div>

      {order.cancelReason ? <ErrorNote>{order.cancelReason}</ErrorNote> : null}
      {!order.runner ? <ErrorNote>This delivery is no longer assigned to you.</ErrorNote> : null}
      <RideTrackerHint order={order} onStart={startSimulation} simulating={simulating} />
    </div>
  );
}

/** Reminder shown to riders whose browser will keep the tab in the background. */
function RideTrackerHint({
  order,
  onStart,
  simulating,
}: {
  order: Order;
  onStart: () => Promise<void>;
  simulating: boolean;
}) {
  if (order.status === 'ON_THE_WAY' || simulating) return null;
  return (
    <p className="text-xs text-ink-500">
      Tip: keep this screen open while riding so the customer's map stays live.{' '}
      <button type="button" className="font-semibold text-forest-600" onClick={() => void onStart()}>
        Start demo tracking
      </button>
    </p>
  );
}
