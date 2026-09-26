import { useState } from 'react';
import { toast } from 'sonner';
import { Field, SectionHeading, Skeleton, Tag } from './ui';
import { useMyWallet, useRequestPayout } from '../lib/queries';
import { dayLabel, rupees } from '../lib/format';
import type { Payout } from '../lib/queries';

const METHODS = [
  { id: 'JAZZCASH', label: 'JazzCash' },
  { id: 'EASYPAISA', label: 'Easypaisa' },
  { id: 'BANK', label: 'Bank transfer' },
] as const;

const STATUS_TONE: Record<Payout['status'], 'forest' | 'cream' | 'clay' | 'wheat'> = {
  PENDING: 'wheat',
  APPROVED: 'forest',
  PAID: 'forest',
  REJECTED: 'clay',
};

/**
 * Earnings wallet shared by the merchant dashboard and the rider app: shows the
 * derived balance and files a withdrawal request for an admin to settle.
 */
export default function WithdrawPanel({ audience }: { audience: 'merchant' | 'rider' }) {
  const wallet = useMyWallet();
  const request = useRequestPayout();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'JAZZCASH' | 'EASYPAISA' | 'BANK'>('JAZZCASH');
  const [accountTitle, setAccountTitle] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  if (wallet.isLoading) return <Skeleton className="h-40 w-full" />;

  const data = wallet.data?.wallet;
  if (!data) return null;
  const value = Number(amount || 0);

  return (
    <section className="card space-y-4 p-4">
      <SectionHeading
        title="Earnings wallet"
        subtitle={
          audience === 'merchant'
            ? `Delivered sales minus ${rupees(data.commission)} platform commission`
            : 'Delivery fees plus tips, minus the COD cash you are carrying'
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Earned', value: data.earned },
          { label: 'Available', value: data.available },
          { label: 'Requested', value: data.pending },
          { label: audience === 'rider' ? 'Cash in hand' : 'Paid out', value: audience === 'rider' ? data.cashInHand : data.paidOut },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-cream-200 bg-cream-50 p-3">
            <p className="label">{stat.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-forest-800">{rupees(stat.value)}</p>
          </div>
        ))}
      </div>

      {audience === 'rider' && data.cashInHand > 0 ? (
        <p className="rounded-2xl border border-wheat-100 bg-wheat-100/40 p-3 text-xs text-ink-700">
          You are holding {rupees(data.cashInHand)} of cash-on-delivery money. Hand it in to the shop or the platform and
          that amount becomes withdrawable.
        </p>
      ) : null}

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (value < data.minPayout) {
            toast.error(`The smallest withdrawal is ${rupees(data.minPayout)}`);
            return;
          }
          if (value > data.available) {
            toast.error(`You can withdraw up to ${rupees(data.available)} right now`);
            return;
          }
          try {
            await request.mutateAsync({ amount: value, method, accountTitle, accountNumber });
            toast.success('Withdrawal requested — we will settle it shortly');
            setAmount('');
          } catch (error) {
            toast.error((error as Error).message);
          }
        }}
      >
        <Field label="Amount" hint={`Minimum ${rupees(data.minPayout)} · available ${rupees(data.available)}`}>
          <div className="flex gap-2">
            <input
              className="input"
              type="number"
              min={data.minPayout}
              max={data.available}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={String(data.minPayout)}
            />
            <button
              type="button"
              className="btn btn-quiet shrink-0 text-xs"
              onClick={() => setAmount(String(data.available))}
              disabled={data.available < data.minPayout}
            >
              All
            </button>
          </div>
        </Field>
        <Field label="Send to">
          <div className="flex gap-2">
            {METHODS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`chip ${method === option.id ? 'chip-active' : ''}`}
                onClick={() => setMethod(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Account title">
          <input className="input" required value={accountTitle} onChange={(event) => setAccountTitle(event.target.value)} placeholder="Ali Raza" />
        </Field>
        <Field label="Account number">
          <input
            className="input"
            required
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
            placeholder="0300 1234567"
          />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className="btn btn-primary w-full" disabled={request.isPending || data.available < data.minPayout}>
            {request.isPending
              ? 'Requesting…'
              : data.available < data.minPayout
                ? `Nothing to withdraw yet (${rupees(data.available)})`
                : `Withdraw ${value >= data.minPayout ? rupees(value) : ''}`}
          </button>
        </div>
      </form>

      <div className="divide-y divide-cream-200 border-t border-cream-200 pt-2">
        {data.payouts.map((payout) => (
          <div key={payout.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div>
              <p className="text-sm font-semibold text-ink-900">{rupees(payout.amount)}</p>
              <p className="text-xs text-ink-500">
                {payout.method.toLowerCase()} · {payout.accountTitle} {payout.accountNumber} · {dayLabel(payout.createdAt)}
              </p>
              {payout.note ? <p className="text-xs text-ink-500">“{payout.note}”</p> : null}
            </div>
            <Tag tone={STATUS_TONE[payout.status]}>{payout.status.toLowerCase()}</Tag>
          </div>
        ))}
        {!data.payouts.length ? <p className="py-3 text-sm text-ink-500">No withdrawals yet.</p> : null}
      </div>
    </section>
  );
}
