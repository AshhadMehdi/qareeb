import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, Field, SectionHeading, Skeleton, Tag } from '../../components/ui';
import { apiGet, apiPatch } from '../../lib/api';
import { useAdminMutations } from '../../lib/queries';
import { dayLabel, rupees } from '../../lib/format';
import type { Promo } from '../../lib/types';
import { useQuery } from '@tanstack/react-query';

export default function AdminMarketing() {
  const promos = useQuery({
    queryKey: ['admin', 'promos'],
    queryFn: () => apiGet<{ promos: Promo[] }>('/admin/promos'),
  });
  const campaigns = useQuery({
    queryKey: ['admin', 'campaigns'],
    queryFn: () =>
      apiGet<{
        campaigns: {
          id: string;
          title: string;
          body: string;
          channel: string;
          audience: string;
          status: string;
          recipients: number;
          sentAt: string | null;
          createdAt: string;
        }[];
      }>('/admin/campaigns'),
  });
  const { createPromo, createCampaign, sendCampaign, broadcast } = useAdminMutations();

  const [promo, setPromo] = useState({
    code: '',
    title: '',
    type: 'PERCENT',
    value: 10,
    minOrder: 500,
    maxDiscount: 200,
  });
  const [campaign, setCampaign] = useState({ title: '', body: '', channel: 'PUSH', audience: 'CUSTOMERS' });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Marketing</h1>
        <p className="text-sm text-ink-500">Platform promos, campaign sends and broadcast announcements.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-4">
          <SectionHeading title="New platform promo" subtitle="Applies to every shop unless it is shop-scoped" />
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await createPromo.mutateAsync({
                  code: promo.code,
                  title: promo.title || null,
                  type: promo.type,
                  value: Number(promo.value),
                  minOrder: Number(promo.minOrder),
                  maxDiscount: promo.maxDiscount ? Number(promo.maxDiscount) : null,
                });
                toast.success(`${promo.code.toUpperCase()} is live`);
                setPromo({ ...promo, code: '', title: '' });
                void promos.refetch();
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            <Field label="Code">
              <input
                className="input uppercase"
                required
                value={promo.code}
                onChange={(event) => setPromo({ ...promo, code: event.target.value })}
                placeholder="ABBOTTABAD20"
              />
            </Field>
            <Field label="Type">
              <select
                className="input"
                value={promo.type}
                onChange={(event) => setPromo({ ...promo, type: event.target.value })}
              >
                <option value="PERCENT">Percent off</option>
                <option value="FIXED">Rupees off</option>
                <option value="FREE_DELIVERY">Free delivery</option>
              </select>
            </Field>
            <Field label="Value">
              <input
                className="input"
                type="number"
                min={0}
                value={promo.value}
                onChange={(event) => setPromo({ ...promo, value: Number(event.target.value) })}
              />
            </Field>
            <Field label="Minimum order">
              <input
                className="input"
                type="number"
                min={0}
                value={promo.minOrder}
                onChange={(event) => setPromo({ ...promo, minOrder: Number(event.target.value) })}
              />
            </Field>
            <Field label="Maximum discount" hint="Optional cap">
              <input
                className="input"
                type="number"
                min={0}
                value={promo.maxDiscount}
                onChange={(event) => setPromo({ ...promo, maxDiscount: Number(event.target.value) })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Internal title">
                <input
                  className="input"
                  value={promo.title}
                  onChange={(event) => setPromo({ ...promo, title: event.target.value })}
                  placeholder="Ramzan grocery offer"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary">
                Create promo
              </button>
            </div>
          </form>

          <div className="divide-y divide-cream-200 border-t border-cream-200 pt-2">
            {(promos.data?.promos ?? []).slice(0, 6).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900">{entry.code}</p>
                  <p className="text-xs text-ink-500">
                    {entry.type === 'PERCENT'
                      ? `${entry.value}% off`
                      : entry.type === 'FIXED'
                        ? `${rupees(entry.value)} off`
                        : 'Free delivery'}
                    {entry.minOrder ? ` · min ${rupees(entry.minOrder)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tag tone={entry.isActive ? 'forest' : 'cream'}>{entry.isActive ? 'active' : 'paused'}</Tag>
                  <button
                    type="button"
                    className="btn btn-quiet px-3 py-1.5 text-xs"
                    onClick={async () => {
                      try {
                        await apiPatch(`/admin/promos/${entry.id}`, { isActive: !entry.isActive });
                        toast.success(entry.isActive ? `${entry.code} paused` : `${entry.code} resumed`);
                        void promos.refetch();
                      } catch (error) {
                        toast.error((error as Error).message);
                      }
                    }}
                  >
                    {entry.isActive ? 'Pause' : 'Resume'}
                  </button>
                </div>
              </div>
            ))}
            {!promos.data?.promos.length ? <p className="py-3 text-sm text-ink-500">No promos yet.</p> : null}
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <SectionHeading title="Broadcast" subtitle="Sends an in-app notification to the selected audience" />
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const result = await broadcast.mutateAsync({
                  title: campaign.title,
                  body: campaign.body,
                  audience: campaign.audience,
                });
                toast.success(`Broadcast sent to ${(result as { sent?: number }).sent ?? 0} people`);
                setCampaign({ ...campaign, title: '', body: '' });
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            <Field label="Title">
              <input
                className="input"
                required
                value={campaign.title}
                onChange={(event) => setCampaign({ ...campaign, title: event.target.value })}
                placeholder="Load-shedding schedule changed"
              />
            </Field>
            <Field label="Message">
              <textarea
                className="input min-h-20"
                required
                value={campaign.body}
                onChange={(event) => setCampaign({ ...campaign, body: event.target.value })}
              />
            </Field>
            <Field label="Audience">
              <select
                className="input"
                value={campaign.audience}
                onChange={(event) => setCampaign({ ...campaign, audience: event.target.value })}
              >
                {['ALL', 'CUSTOMERS', 'MERCHANTS', 'RIDERS'].map((option) => (
                  <option key={option} value={option}>
                    {option.toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit" className="btn btn-primary w-full">
              Send broadcast
            </button>
          </form>

          <SectionHeading title="Campaigns" subtitle="Scheduled and sent" />
          {campaigns.isLoading ? <Skeleton className="h-20 w-full" /> : null}
          <div className="space-y-2">
            {(campaigns.data?.campaigns ?? []).map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-cream-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">{entry.title}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{entry.body}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      {entry.audience.toLowerCase()} · {entry.channel.toLowerCase()} ·{' '}
                      {entry.sentAt ? `sent ${dayLabel(entry.sentAt)} to ${entry.recipients}` : entry.status.toLowerCase()}
                    </p>
                  </div>
                  {entry.status !== 'SENT' ? (
                    <button
                      type="button"
                      className="btn btn-primary px-3 py-1.5 text-xs"
                      onClick={async () => {
                        try {
                          const sent = await sendCampaign.mutateAsync(entry.id);
                          toast.success(`Sent to ${(sent as { sent?: number }).sent ?? 0} people`);
                          void campaigns.refetch();
                        } catch (error) {
                          toast.error((error as Error).message);
                        }
                      }}
                    >
                      Send now
                    </button>
                  ) : (
                    <Tag tone="forest">sent</Tag>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!campaigns.isLoading && !campaigns.data?.campaigns.length ? (
            <EmptyState compact title="No campaigns yet" body="Create one above and send it when you are ready." />
          ) : null}
          <button
            type="button"
            className="btn btn-ghost w-full text-xs"
            onClick={async () => {
              try {
                await createCampaign.mutateAsync({
                  title: campaign.title || 'Weekend fresh stock',
                  body: campaign.body || 'New stock across Mandian and Supply Bazaar shops this weekend.',
                  channel: campaign.channel,
                  audience: campaign.audience,
                });
                toast.success('Draft campaign created');
                void campaigns.refetch();
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            Save as draft campaign
          </button>
        </section>
      </div>
    </div>
  );
}
