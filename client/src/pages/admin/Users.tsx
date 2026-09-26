import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, Skeleton, Tag } from '../../components/ui';
import { useAdminMutations, useAdminUsers } from '../../lib/queries';
import { rupees } from '../../lib/format';

const ROLES = ['ALL', 'CUSTOMER', 'MERCHANT', 'RIDER', 'ADMIN'];

export default function AdminUsers() {
  const [role, setRole] = useState('ALL');
  const [search, setSearch] = useState('');
  const users = useAdminUsers(role);
  const { updateUser } = useAdminMutations();

  const list = (users.data?.users ?? []).filter((user) =>
    search ? `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-forest-800">People</h1>
          <p className="text-sm text-ink-500">{list.length} accounts in this view</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input max-w-52"
            placeholder="Search name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {ROLES.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip ${role === option ? 'chip-active' : ''}`}
              onClick={() => setRole(option)}
            >
              {option.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {users.isLoading ? <Skeleton className="h-40 w-full" /> : null}

      <section className="card overflow-hidden">
        <div className="hidden grid-cols-[2fr_2fr_1fr_1fr_1.6fr] gap-3 border-b border-cream-200 bg-cream-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-500 lg:grid">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Spend</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-cream-200">
          {list.map((user) => (
            <div key={user.id} className="grid gap-2 px-4 py-3 lg:grid-cols-[2fr_2fr_1fr_1fr_1.6fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold text-ink-900">{user.name}</p>
                <p className="text-xs text-ink-500">
                  {user.phone ?? 'no phone'} · {user.walletPoints} points
                </p>
              </div>
              <p className="truncate text-xs text-ink-500">{user.email}</p>
              <div className="flex items-center gap-2">
                <Tag tone={user.role === 'ADMIN' ? 'clay' : user.role === 'RIDER' ? 'forest' : 'cream'}>
                  {user.role.toLowerCase()}
                </Tag>
                {!user.isActive ? <Tag tone="clay">disabled</Tag> : null}
              </div>
              <p className="text-xs text-ink-500">
                {user.orders} orders · {rupees(user.spent)}
              </p>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <select
                  className="input max-w-32 py-1.5 text-xs"
                  value={user.role}
                  onChange={async (event) => {
                    try {
                      await updateUser.mutateAsync({ id: user.id, role: event.target.value });
                      toast.success(`${user.name} is now a ${event.target.value.toLowerCase()}`);
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  {['CUSTOMER', 'MERCHANT', 'RIDER', 'ADMIN'].map((option) => (
                    <option key={option} value={option}>
                      {option.toLowerCase()}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-quiet px-3 py-1.5 text-xs"
                  onClick={async () => {
                    try {
                      await updateUser.mutateAsync({ id: user.id, isActive: !user.isActive });
                      toast.success(user.isActive ? 'Account disabled' : 'Account enabled');
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  {user.isActive ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost px-3 py-1.5 text-xs"
                  onClick={async () => {
                    const value = window.prompt('Set loyalty points for this account', String(user.walletPoints));
                    if (value === null) return;
                    try {
                      await updateUser.mutateAsync({ id: user.id, walletPoints: Number(value) });
                      toast.success('Points updated');
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  Points
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {!users.isLoading && !list.length ? (
        <EmptyState title="No accounts match" body="Try another role filter or clear the search." />
      ) : null}
    </div>
  );
}
