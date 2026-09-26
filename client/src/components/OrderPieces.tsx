import { useEffect, useRef, useState } from 'react';
import { ORDER_STEPS, PAYMENT_LABELS, clockTime, rupees } from '../lib/format';
import type { Order, PaymentMethod } from '../lib/types';
import { Spinner } from './ui';

/**
 * The five states a customer actually asks about — processing (shop accept),
 * rider assigned, en route, rider arriving, completed — rather than one
 * ambiguous progress bar.
 */
const DELIVERY_STATES: { key: string; label: string; hint: string }[] = [
  { key: 'PROCESSING', label: 'Order processing', hint: 'The kitchen has your order' },
  { key: 'RIDER_ASSIGNED', label: 'Rider assigned', hint: 'A rider is coming to the shop' },
  { key: 'EN_ROUTE', label: 'En route to you', hint: 'Your rider picked it up' },
  { key: 'ARRIVING', label: 'Rider arriving', hint: 'Almost at your door' },
  { key: 'COMPLETED', label: 'Completed', hint: 'Delivered' },
];

const STEP_COPY: Record<string, string> = {
  PENDING: 'Order sent to the shop',
  ACCEPTED: 'Shop accepted',
  PREPARING: 'Being packed',
  READY: 'Ready for the rider',
  ON_THE_WAY: 'Rider on the way',
  DELIVERED: 'Delivered',
};

export function OrderTimeline({ order }: { order: Order }) {
  const currentIndex = ORDER_STEPS.indexOf(order.status as (typeof ORDER_STEPS)[number]);
  const cancelled = order.status === 'CANCELLED';

  // Which of the five states the order is in right now.
  const stateIndex = (() => {
    switch (order.status) {
      case 'PENDING':
      case 'ACCEPTED':
      case 'PREPARING':
      case 'READY':
        return 0;
      case 'ON_THE_WAY':
        return 2;
      default:
        return order.status === 'DELIVERED' ? 4 : 0;
    }
  })();
  const showing = stateIndex === 0 && order.runner ? 1 : stateIndex;

  if (cancelled) {
    return (
      <div className="rounded-2xl border border-clay-100 bg-clay-100/50 p-4">
        <p className="text-sm font-bold text-clay-600">Order cancelled</p>
        <p className="mt-1 text-xs text-ink-700">{order.cancelReason ?? 'This order was cancelled.'}</p>
        {order.cancelledAt ? <p className="mt-1 text-xs text-ink-500">{clockTime(order.cancelledAt)}</p> : null}
      </div>
    );
  }

  const live = DELIVERY_STATES[showing]!;

  return (
    <div className="space-y-4">
      {/* Where the order is, in one sentence. */}
      <div className="rounded-2xl border border-forest-100 bg-forest-50 p-4">
        <p className="text-base font-bold text-forest-800">{live.label}</p>
        <p className="mt-0.5 text-xs text-ink-700">{live.hint}</p>
      </div>

      {/* The five states. */}
      <ol className="space-y-0">
        {DELIVERY_STATES.map((state, index) => {
          const done = index <= showing;
          const current = index === showing;
          const isLast = index === DELIVERY_STATES.length - 1;
          return (
            <li key={state.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                    done ? 'border-forest-600 bg-forest-600' : 'border-cream-300 bg-cream-50'
                  }`}
                >
                  {current ? <span className="h-1.5 w-1.5 rounded-full bg-cream-50" /> : null}
                </span>
                {!isLast ? (
                  <span className={`w-0.5 flex-1 ${index < showing ? 'bg-forest-600' : 'bg-cream-300'}`} />
                ) : null}
              </div>
              <div className={isLast ? 'pb-0' : 'pb-4'}>
                <p className={`text-sm ${current ? 'font-bold text-forest-800' : done ? 'font-semibold text-forest-800' : 'text-ink-500'}`}>
                  {state.label}
                </p>
                <p className="text-xs text-ink-500">{state.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <details className="rounded-2xl border border-cream-300 bg-cream-50 p-3.5">
        <summary className="cursor-pointer text-xs font-bold text-forest-700">Full history</summary>
        <ol className="mt-3 space-y-0">
          {ORDER_STEPS.map((step, index) => {
            const done = index <= currentIndex;
            const event = order.statusHistory?.find((entry) => entry.status === step);
            const isLast = index === ORDER_STEPS.length - 1;
            return (
              <li key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-1 grid h-3 w-3 shrink-0 place-items-center rounded-full border-2 ${
                      done ? 'border-forest-600 bg-forest-600' : 'border-cream-300 bg-cream-50'
                    }`}
                  />
                  {!isLast ? (
                    <span className={`w-0.5 flex-1 ${index < currentIndex ? 'bg-forest-600' : 'bg-cream-300'}`} />
                  ) : null}
                </div>
                <div className={isLast ? 'pb-0' : 'pb-3'}>
                  <p className={`text-xs ${done ? 'font-semibold text-forest-800' : 'text-ink-500'}`}>
                    {STEP_COPY[step]}
                  </p>
                  {event ? (
                    <p className="text-[11px] text-ink-500">
                      {clockTime(event.at)}
                      {event.note ? ` · ${event.note}` : ''}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}


export function ChatPanel({
  order,
  messages,
  currentUserId,
  onSend,
  sending,
}: {
  order: Order;
  messages: { id: string; senderId: string; senderRole: string; body: string; createdAt: string }[];
  currentUserId: string;
  onSend: (body: string) => void;
  sending?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  return (
    <div className="space-y-3">
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-cream-300 bg-cream-100 p-3">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-500">
            Ask about substitutions, the gate, or how far the rider is.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === currentUserId;
            return (
              <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? 'bg-forest-600 text-cream-50'
                      : 'border border-cream-300 bg-cream-50 text-ink-900'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                    {message.senderRole === 'RIDER'
                      ? order.runner?.name ?? 'Rider'
                      : message.senderRole === 'MERCHANT'
                        ? order.shop?.name ?? 'Shop'
                        : 'You'}
                  </p>
                  <p className="mt-0.5">{message.body}</p>
                  <p className="mt-1 text-[10px] opacity-70">{clockTime(message.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          onSend(draft.trim());
          setDraft('');
        }}
      >
        <input
          className="input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message"
          maxLength={600}
        />
        <button type="submit" className="btn btn-primary px-4" disabled={sending || !draft.trim()}>
          {sending ? <Spinner /> : 'Send'}
        </button>
      </form>
    </div>
  );
}

const METHODS: { method: PaymentMethod; label: string; note: string }[] = [
  { method: 'COD', label: 'Cash on delivery', note: 'Pay the rider when your order arrives' },
  { method: 'JAZZCASH', label: 'JazzCash', note: 'Mobile wallet · sandbox approval' },
  { method: 'EASYPAISA', label: 'Easypaisa', note: 'Mobile wallet · sandbox approval' },
  { method: 'WALLET', label: 'Qareeb points', note: 'Spend loyalty points instead of cash' },
];

export function PaymentPicker({
  value,
  onChange,
  availablePoints,
  total,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  availablePoints: number;
  total: number;
}) {
  return (
    <div className="space-y-2">
      {METHODS.map((option) => {
        const disabled = option.method === 'WALLET' && availablePoints < total;
        return (
          <button
            key={option.method}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.method)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-50 ${
              value === option.method ? 'border-forest-400 bg-forest-50' : 'border-cream-300 bg-cream-50'
            }`}
          >
            <span
              className={`grid h-4 w-4 place-items-center rounded-full border-2 ${
                value === option.method ? 'border-forest-600' : 'border-cream-300'
              }`}
            >
              {value === option.method ? <span className="h-2 w-2 rounded-full bg-forest-600" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink-900">{option.label}</span>
              <span className="block text-xs text-ink-500">
                {disabled ? `You need ${rupees(total - availablePoints)} more in points` : option.note}
              </span>
            </span>
          </button>
        );
      })}
      <p className="text-xs text-ink-500">
        JazzCash and Easypaisa run in sandbox mode in this build: payments are recorded and approved instantly so you
        can walk the whole order flow.
      </p>
    </div>
  );
}

export function PaymentSummary({ order }: { order: Order }) {
  return (
    <div className="space-y-1.5 text-sm">
      <Row label="Subtotal" value={rupees(order.subtotal)} />
      <Row label="Delivery" value={order.deliveryFee ? rupees(order.deliveryFee) : 'Free'} />
      {order.serviceFee ? <Row label="Service fee" value={rupees(order.serviceFee)} /> : null}
      {order.discount ? <Row label="Discount" value={`− ${rupees(order.discount)}`} tone="forest" /> : null}
      {order.tip ? <Row label="Rider tip" value={rupees(order.tip)} /> : null}
      <div className="row-divider mt-2 flex items-center justify-between pt-2">
        <span className="font-bold text-forest-800">Total</span>
        <span className="font-bold text-forest-800">{rupees(order.total)}</span>
      </div>
      <p className="text-xs text-ink-500">
        {PAYMENT_LABELS[order.paymentMethod]} · {order.paymentStatus.toLowerCase()}
      </p>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'forest' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className={`font-medium ${tone === 'forest' ? 'text-forest-600' : 'text-ink-900'}`}>{value}</span>
    </div>
  );
}
