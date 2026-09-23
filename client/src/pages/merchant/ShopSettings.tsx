import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import MapView from '../../components/MapView';
import { EmptyState, Field, SectionHeading, Skeleton, Tag } from '../../components/ui';
import {
  useDeleteZone,
  useMerchantOverview,
  useSaveZones,
  useUpdateShop,
} from '../../lib/queries';
import { rupees } from '../../lib/format';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function MerchantShop() {
  const shop = useMerchantOverview();
  const updateShop = useUpdateShop();
  const saveZone = useSaveZones();
  const deleteZone = useDeleteZone();

  const [details, setDetails] = useState({
    name: '',
    category: '',
    addressLine: '',
    phone: '',
    description: '',
    prepTimeMin: 15,
    minOrder: 0,
    deliveryMode: 'PLATFORM_RIDER',
  });
  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed?: boolean }>>({});
  const [pin, setPin] = useState({ lat: 34.1688, lng: 73.2215 });
  const [zone, setZone] = useState({ name: '', radiusKm: 3, fee: 80, freeAbove: 2000, etaMinutes: 30 });

  useEffect(() => {
    if (!shop.data) return;
    const record = shop.data.shop;
    setDetails({
      name: record.name,
      category: record.category,
      addressLine: record.addressLine,
      phone: record.phone ?? '',
      description: record.description ?? '',
      prepTimeMin: record.prepTimeMin,
      minOrder: record.minOrder,
      deliveryMode: record.deliveryMode,
    });
    setHours(record.hours);
    setPin({ lat: record.lat, lng: record.lng });
  }, [shop.data]);

  if (shop.isLoading) return <Skeleton className="h-40 w-full" />;
  if (shop.isError || !shop.data) {
    return (
      <EmptyState
        title="No shop to configure yet"
        body="Create your shop and this page becomes your control room."
        action={
          <Link to="/merchant/setup" className="btn btn-primary">
            Start setup
          </Link>
        }
      />
    );
  }

  const zones = shop.data.zones;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Shop settings</h1>
        <p className="text-sm text-ink-500">Details, opening hours and delivery rings — all live for customers.</p>
      </div>

      <section className="card p-4">
        <SectionHeading title="Details and branding" subtitle="What customers see at the top of your shop page" />
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await updateShop.mutateAsync({
                ...details,
                phone: details.phone || null,
                description: details.description || null,
                lat: pin.lat,
                lng: pin.lng,
              });
              toast.success('Shop details saved');
            } catch (error) {
              toast.error((error as Error).message);
            }
          }}
        >
          <Field label="Shop name">
            <input
              className="input"
              value={details.name}
              onChange={(event) => setDetails({ ...details, name: event.target.value })}
            />
          </Field>
          <Field label="Category">
            <select
              className="input"
              value={details.category}
              onChange={(event) => setDetails({ ...details, category: event.target.value })}
            >
              {['grocery', 'vegetables', 'fruit', 'meat', 'dairy', 'bakery', 'pharmacy', 'household'].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone">
            <input
              className="input"
              value={details.phone}
              onChange={(event) => setDetails({ ...details, phone: event.target.value })}
              placeholder="+92 992 000 000"
            />
          </Field>
          <Field label="Delivery mode">
            <select
              className="input"
              value={details.deliveryMode}
              onChange={(event) => setDetails({ ...details, deliveryMode: event.target.value })}
            >
              <option value="PLATFORM_RIDER">Qareeb riders</option>
              <option value="SHOP_DELIVERY">Own delivery staff</option>
              <option value="PICKUP">Pickup only</option>
            </select>
          </Field>
          <Field label="Preparation time (minutes)">
            <input
              className="input"
              type="number"
              min={5}
              value={details.prepTimeMin}
              onChange={(event) => setDetails({ ...details, prepTimeMin: Number(event.target.value) })}
            />
          </Field>
          <Field label="Minimum order (PKR)">
            <input
              className="input"
              type="number"
              min={0}
              value={details.minOrder}
              onChange={(event) => setDetails({ ...details, minOrder: Number(event.target.value) })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Street address">
              <input
                className="input"
                value={details.addressLine}
                onChange={(event) => setDetails({ ...details, addressLine: event.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Short description">
              <textarea
                className="input min-h-20"
                value={details.description}
                onChange={(event) => setDetails({ ...details, description: event.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <p className="label">Shop location</p>
            <div className="mt-1.5">
              <MapView
                center={[pin.lat, pin.lng]}
                zoom={16}
                height="14rem"
                markers={[{ id: 'shop', lat: pin.lat, lng: pin.lng, label: details.name, kind: 'shop' }]}
                onMapClick={(lat, lng) => setPin({ lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) })}
              />
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Tap the map to correct the pin — {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
            </p>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary" disabled={updateShop.isPending}>
              Save shop details
            </button>
          </div>
        </form>
      </section>

      <section className="card p-4">
        <SectionHeading title="Opening hours" subtitle="Times are local to Abbottabad" />
        <div className="space-y-2">
          {DAYS.map((day) => {
            const slot = hours[day] ?? { open: '08:00', close: '23:00' };
            return (
              <div key={day} className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-sm font-semibold capitalize text-ink-700">{day}</span>
                <input
                  type="time"
                  className="input max-w-32"
                  value={slot.open}
                  onChange={(event) =>
                    setHours({ ...hours, [day]: { ...slot, open: event.target.value, closed: false } })
                  }
                />
                <span className="text-xs text-ink-500">to</span>
                <input
                  type="time"
                  className="input max-w-32"
                  value={slot.close}
                  onChange={(event) => setHours({ ...hours, [day]: { ...slot, close: event.target.value } })}
                />
                <label className="flex items-center gap-2 text-xs font-medium text-ink-500">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-forest-600"
                    checked={Boolean(slot.closed)}
                    onChange={(event) => setHours({ ...hours, [day]: { ...slot, closed: event.target.checked } })}
                  />
                  Closed
                </label>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="btn btn-primary mt-3"
          disabled={updateShop.isPending}
          onClick={async () => {
            try {
              await updateShop.mutateAsync({ hours });
              toast.success('Opening hours saved');
            } catch (error) {
              toast.error((error as Error).message);
            }
          }}
        >
          Save hours
        </button>
      </section>

      <section className="card p-4">
        <SectionHeading
          title="Delivery rings"
          subtitle="Each ring sets a fee and ETA. The first ring that reaches the customer wins."
        />
        <div className="space-y-2">
          {zones.map((ring) => (
            <div key={ring.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-cream-200 p-3">
              <span className="text-sm font-semibold text-forest-800">{ring.name}</span>
              <Tag>{ring.radiusKm} km</Tag>
              <Tag>{rupees(ring.fee)}</Tag>
              {ring.freeAbove ? <Tag tone="forest">Free above {rupees(ring.freeAbove)}</Tag> : null}
              <Tag>{ring.etaMinutes} min</Tag>
              <button
                type="button"
                className="btn btn-quiet ml-auto px-3 py-1.5 text-xs"
                onClick={async () => {
                  try {
                    await deleteZone.mutateAsync(ring.id);
                    toast.success('Ring removed');
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                Remove
              </button>
            </div>
          ))}
          {!zones.length ? <p className="text-sm text-ink-500">No rings yet — add at least one to deliver.</p> : null}
        </div>

        <div className="mt-4">
          <MapView
            center={[pin.lat, pin.lng]}
            zoom={13}
            height="14rem"
            markers={[{ id: 'shop', lat: pin.lat, lng: pin.lng, label: details.name, kind: 'shop' }]}
            rings={zones.map((ring) => ({ id: ring.id, lat: pin.lat, lng: pin.lng, radiusKm: ring.radiusKm }))}
          />
        </div>

        <form
          className="mt-4 grid gap-3 sm:grid-cols-5"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await saveZone.mutateAsync({ ...zone, sortOrder: zones.length });
              toast.success('Delivery ring added');
              setZone({ ...zone, name: '' });
            } catch (error) {
              toast.error((error as Error).message);
            }
          }}
        >
          <Field label="Ring name">
            <input
              className="input"
              value={zone.name}
              required
              placeholder="Within 3 km"
              onChange={(event) => setZone({ ...zone, name: event.target.value })}
            />
          </Field>
          <Field label="Radius (km)">
            <input
              className="input"
              type="number"
              min={0.5}
              step={0.5}
              value={zone.radiusKm}
              onChange={(event) => setZone({ ...zone, radiusKm: Number(event.target.value) })}
            />
          </Field>
          <Field label="Fee (PKR)">
            <input
              className="input"
              type="number"
              min={0}
              value={zone.fee}
              onChange={(event) => setZone({ ...zone, fee: Number(event.target.value) })}
            />
          </Field>
          <Field label="Free above">
            <input
              className="input"
              type="number"
              min={0}
              value={zone.freeAbove}
              onChange={(event) => setZone({ ...zone, freeAbove: Number(event.target.value) })}
            />
          </Field>
          <div className="flex items-end">
            <button type="submit" className="btn btn-primary w-full" disabled={saveZone.isPending}>
              Add ring
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
