import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, SectionHeading, Skeleton, Tag } from '../../components/ui';
import { useAdminPayMutations, useAdminPayouts } from '../../lib/queries';
import { dayLabel, rupees } from '../../lib/format';

const FILTERS = ['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'];

export default function AdminPayouts() {
  const [filter, setFilter] = useState('ALL');
  const payouts = useAdminPayouts(filter);
  const { decide } = useAdminPayMutations();

  const total = (status: string) => payouts.data?.totals.find((row) => row.status === status);

  const act = async (id: string, status: 'APPROVED' | 'PAID' | 'REJECTED', name: string | null) => {
    let note: string | undefined;
    if (status === 'REJECTED') {
      const reason = window.prompt('Why is this payout being declined?', 'Send a corrected account number');
      if (reason === null) return;
      note = reason;
    }
    try {
      await decide.mutateAsync({ id, status, note });
      toast.success(status === 'PAID' ? `Paid ${name ?? 'the account'}` : `Request ${status.toLowerCase()}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-forest-800">Payouts</h1>
          <p className="text-sm text-ink-500">
            Merchant and rider withdrawals. {total('PENDING')?.count ?? 0} waiting ·{' '}
            {rupees(total('PENDING')?.sum ?? 0)} pending
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <section className="grid gap-3 sm:grid-cols-4">
        {(['PENDING', 'APPROVED', 'PAID', 'REJECTED'] as const).map((status) => {
          const row = total(status);
          return (
            <div key={status} className="card p-4">
              <p className="label">{status.toLowerCase()}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-forest-800">{rupees(row?.sum ?? 0)}</p>
              <p className="text-xs text-ink-500">{row?.count ?? 0} requests</p>
            </div>
          );
        })}
      </section>

      {payouts.isLoading ? <Skeleton className="h-40 w-full" /> : null}

      <section className="card overflow-hidden">
        <SectionHeading title="Queue" subtitle="Reviewing is a two-step flow: approve, then mark paid once the transfer lands." />
        <div className="divide-y divide-cream-200">
          {(payouts.data?.payouts ?? []).map((payout) => (
            <div key={payout.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-forest-800">{rupees(payout.amount)}</p>
                  <Tag tone={payout.role === 'RIDER' ? 'forest' : 'cream'}>{payout.role.toLowerCase()}</Tag>
                  <Tag>{payout.method.toLowerCase()}</Tag>
                  <Tag tone={payout.status === 'PAID' ? 'forest' : payout.status === 'REJECTED' ? 'clay' : 'wheat'}>
                    {payout.status.toLowerCase()}
                  </Tag>
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  {payout.name} · {payout.shopName ?? payout.email} · {payout.phone ?? 'no phone'}
                </p>
                <p className="text-xs text-ink-500">
                  {payout.accountTitle} · {payout.accountNumber} · requested {dayLabel(payout.createdAt)}
                </p>
                {payout.note ? <p className="text-xs text-ink-500">“{payout.note}”</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {payout.status === 'PENDING' ? (
                  <button
                    type="button"
                    className="btn btn-quiet px-3 py-1.5 text-xs"
                    disabled={decide.isPending}
                    onClick={() => act(payout.id, 'APPROVED', payout.name)}
                  >
                    Approve
                  </button>
                ) : null}
                {payout.status === 'PENDING' || payout.status === 'APPROVED' ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary px-3 py-1.5 text-xs"
                      disabled={decide.isPending}
                      onClick={() => act(payout.id, 'PAID', payout.name)}
                    >
                      Mark paid
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost px-3 py-1.5 text-xs"
                      disabled={decide.isPending}
                      onClick={() => act(payout.id, 'REJECTED', payout.name)}
                    >
                      Decline
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-ink-500">{payout.decidedAt ? dayLabel(payout.decidedAt) : ''}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {!payouts.isLoading && !payouts.data?.payouts.length ? (
        <EmptyState title="No withdrawal requests" body="Merchant and rider requests land here the moment they ask for a payout." />
      ) : null}
    </div>
  );
}
