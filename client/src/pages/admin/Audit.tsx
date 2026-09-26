import { EmptyState, SectionHeading, Skeleton, Tag } from '../../components/ui';
import { useAdminAudit } from '../../lib/queries';
import { timeAgo } from '../../lib/format';

export default function AdminAudit() {
  const audit = useAdminAudit();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Audit trail</h1>
        <p className="text-sm text-ink-500">
          Every administrative action: shop approvals, settings changes, campaign sends and user edits.
        </p>
      </div>

      {audit.isLoading ? <Skeleton className="h-40 w-full" /> : null}

      <section className="card overflow-hidden">
        <div className="hidden grid-cols-[1.4fr_1.4fr_1.6fr_1fr] gap-3 border-b border-cream-200 bg-cream-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-500 lg:grid">
          <span>Action</span>
          <span>Entity</span>
          <span>Actor</span>
          <span className="text-right">When</span>
        </div>
        <div className="divide-y divide-cream-200">
          {(audit.data?.logs ?? []).map((entry) => (
            <div key={entry.id} className="grid gap-1 px-4 py-3 lg:grid-cols-[1.4fr_1.4fr_1.6fr_1fr] lg:items-center">
              <div className="flex items-center gap-2">
                <Tag tone={entry.action.includes('suspend') || entry.action.includes('cancel') ? 'clay' : 'forest'}>
                  {entry.action}
                </Tag>
              </div>
              <p className="truncate text-xs text-ink-500">
                {entry.entity}
                {entry.entityId ? ` · ${entry.entityId.slice(0, 10)}` : ''}
              </p>
              <p className="text-sm text-ink-700">{entry.actorName}</p>
              <p className="text-xs text-ink-500 lg:text-right">{timeAgo(entry.createdAt)}</p>
            </div>
          ))}
        </div>
      </section>

      {!audit.isLoading && !audit.data?.logs.length ? (
        <EmptyState title="Nothing logged yet" body="Actions appear here as soon as you approve a shop or change settings." />
      ) : null}

      <section className="card p-4">
        <SectionHeading title="What gets logged" />
        <ul className="space-y-1 text-sm text-ink-500">
          <li>· Shop status changes (approve, suspend, reinstate) with the reason</li>
          <li>· Platform settings updates, including which keys changed</li>
          <li>· Promo creation, campaign sends and broadcast reach</li>
          <li>· User role changes, account disabling and loyalty point adjustments</li>
        </ul>
      </section>
    </div>
  );
}
