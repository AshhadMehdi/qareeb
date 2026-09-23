import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '../lib/api';
import { apiPatch } from '../lib/api';
import { useProfile } from '../lib/queries';
import { ABBOTTABAD_CENTER, useLocation, type PickupPoint } from '../store/location';
import { useAuth } from '../store/auth';
import type { Address } from '../lib/types';
import MapView from './MapView';
import { ErrorNote, Field, Modal, Spinner } from './ui';

const AREAS = [
  'Mandian',
  'Supply Bazaar',
  'Fawara Chowk',
  'Kakul Road',
  'Nawanshehr',
  'Jinnahabad',
  'Shimla Hill',
  'Kehal',
  'Cantt',
  'Salhad',
];

export default function LocationPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { point, setFromAddress, setPoint, useGps, locating, error } = useLocation();
  const token = useAuth((state) => state.token);
  const profile = useProfile();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) setAdding(false);
  }, [open]);

  if (!open) return null;

  const saved = profile.data?.addresses ?? [];

  return (
    <Modal open={open} title="Where should we deliver?" onClose={onClose}>
      <div className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {token ? (
          <button
            type="button"
            className="btn btn-ghost w-full justify-between"
            disabled={locating}
            onClick={async () => {
              const next = await useGps();
              if (next) {
                toast.success('Using your current location');
                onClose();
              } else {
                toast.error('Could not read your location — pick an area instead');
              }
            }}
          >
            <span>Use my current location</span>
            {locating ? <Spinner /> : <span className="text-xs text-ink-500">GPS</span>}
          </button>
        ) : null}

        {saved.length ? (
          <div className="space-y-2">
            <p className="label">Saved addresses</p>
            {saved.map((address: Address) => (
              <button
                key={address.id}
                type="button"
                onClick={() => {
                  setFromAddress(address);
                  toast.success(`Delivering to ${address.label}`);
                  onClose();
                }}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${
                  point.addressId === address.id
                    ? 'border-forest-400 bg-forest-50'
                    : 'border-cream-300 bg-cream-50 hover:bg-cream-100'
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
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="label">Abbottabad neighbourhoods</p>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((area) => (
              <button
                key={area}
                type="button"
                className={`chip ${point.area === area ? 'chip-active' : ''}`}
                onClick={() => {
                  const match = AREA_COORDS[area] ?? ABBOTTABAD_CENTER;
                  setPoint({
                    label: area,
                    line1: `${area}, Abbottabad`,
                    area,
                    lat: match.lat,
                    lng: match.lng,
                    source: 'default',
                    addressId: null,
                  });
                  toast.success(`Showing shops near ${area}`);
                  onClose();
                }}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {token ? (
          adding ? (
            <AddressForm
              defaultCenter={{ lat: point.lat, lng: point.lng }}
              onDone={() => {
                void profile.refetch();
                setAdding(false);
                onClose();
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button type="button" className="btn btn-primary w-full" onClick={() => setAdding(true)}>
              Add a new address
            </button>
          )
        ) : (
          <p className="rounded-xl border border-cream-300 bg-cream-100 px-3 py-2 text-xs text-ink-500">
            Sign in to save addresses and track deliveries.
          </p>
        )}
      </div>
    </Modal>
  );
}

export function AddressForm({
  defaultCenter,
  onDone,
  onCancel,
  initial,
}: {
  defaultCenter: { lat: number; lng: number };
  onDone: (address: Address) => void;
  onCancel?: () => void;
  initial?: Address | null;
}) {
  const queryClient = useQueryClient();
  const setFromAddress = useLocation((state) => state.setFromAddress);
  const [form, setForm] = useState({
    label: initial?.label ?? 'Home',
    line1: initial?.line1 ?? '',
    area: initial?.area ?? '',
    city: initial?.city ?? 'Abbottabad',
    instructions: initial?.instructions ?? '',
    isDefault: initial?.isDefault ?? false,
  });
  const [pin, setPin] = useState({ lat: initial?.lat ?? defaultCenter.lat, lng: initial?.lng ?? defaultCenter.lng });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, ...pin };
      const data = initial
        ? await apiPatch<{ address: Address }>(`/users/me/addresses/${initial.id}`, body)
        : await apiPost<{ address: Address }>('/users/me/addresses', body);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      setFromAddress(data.address);
      onDone(data.address);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-cream-300 bg-cream-100 p-4">
      <p className="text-sm font-bold text-forest-800">{initial ? 'Edit address' : 'New delivery address'}</p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Label">
          <input
            className="input"
            value={form.label}
            onChange={(event) => setForm({ ...form, label: event.target.value })}
            placeholder="Home / Office"
          />
        </Field>
        <Field label="Area">
          <input
            className="input"
            value={form.area ?? ''}
            onChange={(event) => setForm({ ...form, area: event.target.value })}
            placeholder="Mandian"
            list="qareeb-areas"
          />
          <datalist id="qareeb-areas">
            {AREAS.map((area) => (
              <option key={area} value={area} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field label="Street address" hint="House or shop number, street, mohalla">
        <input
          className="input"
          value={form.line1}
          onChange={(event) => setForm({ ...form, line1: event.target.value })}
          placeholder="House 42, Street 3, Mandian"
        />
      </Field>

      <Field label="Rider instructions" hint="Optional — gate colour, landmark, who to ask for">
        <input
          className="input"
          value={form.instructions ?? ''}
          onChange={(event) => setForm({ ...form, instructions: event.target.value })}
          placeholder="Green gate next to the chemist"
        />
      </Field>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label">Pin the exact spot</span>
          <button
            type="button"
            className="btn btn-quiet px-2.5 py-1 text-xs"
            disabled={locating}
            onClick={async () => {
              setLocating(true);
              const next = await useLocation.getState().useGps();
              setLocating(false);
              if (next) {
                setPin({ lat: next.lat, lng: next.lng });
                await reverseFill(next.lat, next.lng);
              }
            }}
          >
            {locating ? <Spinner className="h-3.5 w-3.5" /> : 'Use GPS'}
          </button>
        </div>
        <MapView
          center={[pin.lat, pin.lng]}
          zoom={15}
          height="13rem"
          markers={[{ id: 'pin', lat: pin.lat, lng: pin.lng, label: form.label, kind: 'home' }]}
          onMapClick={async (lat, lng) => {
            setPin({ lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) });
            await reverseFill(lat, lng);
          }}
        />
        <p className="mt-1 text-xs text-ink-500">
          Tap the map to move the pin — {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
        <input
          type="checkbox"
          className="h-4 w-4 accent-forest-600"
          checked={Boolean(form.isDefault)}
          onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
        />
        Make this my default delivery address
      </label>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="flex gap-2">
        <button type="button" className="btn btn-primary flex-1" disabled={saving} onClick={save}>
          {saving ? <Spinner /> : null}
          {initial ? 'Save changes' : 'Save address'}
        </button>
        {onCancel ? (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );

  async function reverseFill(lat: number, lng: number) {
    // Best-effort reverse geocoding; the form still works if it fails.
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en`,
        { headers: { Accept: 'application/json' } },
      );
      if (!response.ok) return;
      const data = (await response.json()) as { address?: Record<string, string>; display_name?: string };
      const road = data.address?.road ?? data.address?.suburb ?? data.address?.neighbourhood ?? '';
      const area = data.address?.suburb ?? data.address?.village ?? data.address?.town ?? '';
      setForm((current) => ({
        ...current,
        line1: current.line1 || road || data.display_name?.split(',').slice(0, 2).join(',') || '',
        area: current.area || area,
      }));
    } catch {
      /* offline or rate limited — leave the fields as they are */
    }
  }
}

const AREA_COORDS: Record<string, PickupPoint> = {
  Mandian: { label: 'Mandian', line1: 'Mandian, Abbottabad', area: 'Mandian', lat: 34.1688, lng: 73.2265, source: 'default', addressId: null },
  'Supply Bazaar': { label: 'Supply Bazaar', line1: 'Supply Bazaar, Abbottabad', area: 'Supply Bazaar', lat: 34.1572, lng: 73.2219, source: 'default', addressId: null },
  'Fawara Chowk': { label: 'Fawara Chowk', line1: 'Fawara Chowk, Abbottabad', area: 'Fawara Chowk', lat: 34.1557, lng: 73.2194, source: 'default', addressId: null },
  'Kakul Road': { label: 'Kakul Road', line1: 'Kakul Road, Abbottabad', area: 'Kakul Road', lat: 34.1806, lng: 73.2441, source: 'default', addressId: null },
  Nawanshehr: { label: 'Nawanshehr', line1: 'Nawanshehr, Abbottabad', area: 'Nawanshehr', lat: 34.1729, lng: 73.2379, source: 'default', addressId: null },
  Jinnahabad: { label: 'Jinnahabad', line1: 'Jinnahabad, Abbottabad', area: 'Jinnahabad', lat: 34.1521, lng: 73.2301, source: 'default', addressId: null },
  'Shimla Hill': { label: 'Shimla Hill', line1: 'Shimla Hill, Abbottabad', area: 'Shimla Hill', lat: 34.1621, lng: 73.2154, source: 'default', addressId: null },
  Kehal: { label: 'Kehal', line1: 'Kehal Bazaar, Abbottabad', area: 'Kehal', lat: 34.1928, lng: 73.2425, source: 'default', addressId: null },
  Cantt: { label: 'Cantt', line1: 'Cantt, Abbottabad', area: 'Cantt', lat: 34.1499, lng: 73.2011, source: 'default', addressId: null },
  Salhad: { label: 'Salhad', line1: 'Salhad, Abbottabad', area: 'Salhad', lat: 34.1200, lng: 73.2100, source: 'default', addressId: null },
};
