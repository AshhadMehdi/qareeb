import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import MapView from '../../components/MapView';
import { Field, SectionHeading, Skeleton, Tag } from '../../components/ui';
import { apiGet, apiPatch, apiPost } from '../../lib/api';
import { useAdminMutations, useAdminSettings } from '../../lib/queries';
import { rupees } from '../../lib/format';
import { useQuery } from '@tanstack/react-query';

type Area = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  radiusKm: number;
  baseFee: number;
  surgeMultiplier: number;
  isActive: boolean;
};

export default function AdminSettings() {
  const settings = useAdminSettings();
  const { saveSettings } = useAdminMutations();
  const areas = useQuery({
    queryKey: ['admin', 'service-areas'],
    queryFn: () => apiGet<{ areas: Area[] }>('/admin/service-areas'),
  });

  const [form, setForm] = useState<Record<string, string | number>>({});
  const [newArea, setNewArea] = useState({ name: '', radiusKm: 6, baseFee: 70, surgeMultiplier: 1 });

  useEffect(() => {
    if (settings.data?.settings) setForm(settings.data.settings);
  }, [settings.data]);

  if (settings.isLoading) return <Skeleton className="h-40 w-full" />;

  const number = (key: string) => Number(form[key] ?? 0);
  const text = (key: string) => String(form[key] ?? '');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Platform settings</h1>
        <p className="text-sm text-ink-500">
          Fees, commission and operational limits apply across all shops immediately.
        </p>
      </div>

      <section className="card p-4">
        <SectionHeading title="Market" subtitle="Where Qareeb operates today" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="City name">
            <input className="input" value={text('cityName')} onChange={(e) => setForm({ ...form, cityName: e.target.value })} />
          </Field>
          <Field label="City centre latitude">
            <input
              className="input"
              type="number"
              step={0.0001}
              value={number('cityLat')}
              onChange={(e) => setForm({ ...form, cityLat: Number(e.target.value) })}
            />
          </Field>
          <Field label="City centre longitude">
            <input
              className="input"
              type="number"
              step={0.0001}
              value={number('cityLng')}
              onChange={(e) => setForm({ ...form, cityLng: Number(e.target.value) })}
            />
          </Field>
        </div>
      </section>

      <section className="card p-4">
        <SectionHeading title="Money" subtitle="What the platform earns and what customers pay" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Service fee %" hint="Added to every order">
            <input
              className="input"
              type="number"
              step={0.5}
              min={0}
              max={20}
              value={number('serviceFeePct')}
              onChange={(e) => setForm({ ...form, serviceFeePct: Number(e.target.value) })}
            />
          </Field>
          <Field label="Commission %" hint="Platform take from shops">
            <input
              className="input"
              type="number"
              step={0.5}
              min={0}
              max={40}
              value={number('commissionPct')}
              onChange={(e) => setForm({ ...form, commissionPct: Number(e.target.value) })}
            />
          </Field>
          <Field label="Loyalty points per Rs 100">
            <input
              className="input"
              type="number"
              step={0.5}
              min={0}
              max={50}
              value={number('loyaltyPointsPer100')}
              onChange={(e) => setForm({ ...form, loyaltyPointsPer100: Number(e.target.value) })}
            />
          </Field>
          <Field label="Delivery radius cap (km)">
            <input
              className="input"
              type="number"
              step={0.5}
              min={1}
              max={50}
              value={number('radiusCapKm')}
              onChange={(e) => setForm({ ...form, radiusCapKm: Number(e.target.value) })}
            />
          </Field>
        </div>
      </section>

      <section className="card p-4">
        <SectionHeading title="Operations" subtitle="Cancellation window, support line and the home banner" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cancellation window (minutes)" hint="After the shop accepts">
            <input
              className="input"
              type="number"
              min={0}
              max={120}
              value={number('cancelWindowMinutes')}
              onChange={(e) => setForm({ ...form, cancelWindowMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Support phone">
            <input
              className="input"
              value={text('supportPhone')}
              onChange={(e) => setForm({ ...form, supportPhone: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Home banner">
              <input
                className="input"
                value={text('announcement')}
                onChange={(e) => setForm({ ...form, announcement: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary mt-4"
          disabled={saveSettings.isPending}
          onClick={async () => {
            try {
              await saveSettings.mutateAsync(form);
              toast.success('Platform settings saved');
            } catch (error) {
              toast.error((error as Error).message);
            }
          }}
        >
          Save settings
        </button>
      </section>

      <section className="card p-4">
        <SectionHeading title="Service areas" subtitle="Surge pricing applies inside each area" />
        <MapView
          center={[number('cityLat') || 34.1688, number('cityLng') || 73.2215]}
          zoom={12}
          height="16rem"
          markers={(areas.data?.areas ?? []).map((area) => ({
            id: area.id,
            lat: area.lat,
            lng: area.lng,
            label: area.name,
            kind: 'shop' as const,
          }))}
          rings={(areas.data?.areas ?? []).map((area) => ({
            id: area.id,
            lat: area.lat,
            lng: area.lng,
            radiusKm: area.radiusKm,
          }))}
        />

        <div className="mt-4 space-y-2">
          {(areas.data?.areas ?? []).map((area) => (
            <div key={area.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-cream-200 p-3">
              <span className="text-sm font-semibold text-forest-800">{area.name}</span>
              <Tag>{area.radiusKm} km</Tag>
              <Tag>{rupees(area.baseFee)} base</Tag>
              <Tag tone={area.surgeMultiplier > 1 ? 'clay' : 'cream'}>×{area.surgeMultiplier}</Tag>
              <button
                type="button"
                className="btn btn-quiet ml-auto px-3 py-1.5 text-xs"
                onClick={async () => {
                  try {
                    await apiPatch(`/admin/service-areas/${area.id}`, { isActive: !area.isActive });
                    toast.success(area.isActive ? 'Area paused' : 'Area activated');
                    void areas.refetch();
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                {area.isActive ? 'Pause' : 'Activate'}
              </button>
            </div>
          ))}
        </div>

        <form
          className="mt-4 grid gap-3 sm:grid-cols-4"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await apiPost('/admin/service-areas', {
                ...newArea,
                city: text('cityName') || 'Abbottabad',
                lat: number('cityLat') || 34.1688,
                lng: number('cityLng') || 73.2215,
              });
              toast.success('Service area added');
              setNewArea({ ...newArea, name: '' });
              void areas.refetch();
            } catch (error) {
              toast.error((error as Error).message);
            }
          }}
        >
          <Field label="Area name">
            <input
              className="input"
              required
              value={newArea.name}
              onChange={(event) => setNewArea({ ...newArea, name: event.target.value })}
              placeholder="Havelian Road"
            />
          </Field>
          <Field label="Radius (km)">
            <input
              className="input"
              type="number"
              step={0.5}
              value={newArea.radiusKm}
              onChange={(event) => setNewArea({ ...newArea, radiusKm: Number(event.target.value) })}
            />
          </Field>
          <Field label="Base fee">
            <input
              className="input"
              type="number"
              value={newArea.baseFee}
              onChange={(event) => setNewArea({ ...newArea, baseFee: Number(event.target.value) })}
            />
          </Field>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full">
              Add area
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
