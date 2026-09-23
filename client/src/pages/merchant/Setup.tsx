import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MapView from '../../components/MapView';
import { ErrorNote, Field, SectionHeading, Spinner } from '../../components/ui';
import { apiPost } from '../../lib/api';
import { useMerchantOverview } from '../../lib/queries';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const CATEGORIES = [
  { key: 'grocery', label: 'Karyana & grocery' },
  { key: 'vegetables', label: 'Sabzi & fruit' },
  { key: 'meat', label: 'Meat & poultry' },
  { key: 'dairy', label: 'Dairy' },
  { key: 'bakery', label: 'Bakery & sweets' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'household', label: 'Household' },
];

export default function MerchantSetup() {
  const navigate = useNavigate();
  const existing = useMerchantOverview();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    category: 'grocery',
    addressLine: '',
    phone: '',
    description: '',
    prepTimeMin: 15,
    minOrder: 200,
    deliveryMode: 'PLATFORM_RIDER',
  });
  const [pin, setPin] = useState({ lat: 34.1688, lng: 73.2215 });
  const [hours, setHours] = useState(
    Object.fromEntries(
      DAYS.map((day) => [day, { open: day === 'sunday' ? '10:00' : '08:00', close: day === 'sunday' ? '20:00' : '23:00' }]),
    ) as Record<string, { open: string; close: string }>,
  );

  if (existing.data) {
    return (
      <div className="card p-5">
        <SectionHeading title="Your shop is already set up" subtitle={existing.data.shop.name} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => navigate('/merchant')}>
            Go to dashboard
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/merchant/shop')}>
            Edit shop settings
          </button>
        </div>
      </div>
    );
  }

  const steps = ['Shop details', 'Location', 'Opening hours'];

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiPost('/merchant/shops', {
        ...form,
        phone: form.phone || null,
        description: form.description || null,
        lat: pin.lat,
        lng: pin.lng,
        hours,
      });
      toast.success('Shop created — add products to start selling');
      void existing.refetch();
      navigate('/merchant/products');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Set up your shop</h1>
        <p className="text-sm text-ink-500">Three steps. You can change everything later from shop settings.</p>
      </div>

      <div className="flex gap-2">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={`flex-1 rounded-2xl border p-3 text-left text-xs ${
              step === index ? 'border-forest-400 bg-forest-50' : 'border-cream-300 bg-cream-50'
            }`}
          >
            <span className="block font-bold text-forest-800">
              {index + 1}. {label}
            </span>
            <span className="text-ink-500">
              {index === 0 ? 'Name, category, contact' : index === 1 ? 'Pin your exact shop' : 'When you are open'}
            </span>
          </button>
        ))}
      </div>

      <section className="card space-y-4 p-4">
        {step === 0 ? (
          <>
            <Field label="Shop name">
              <input
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Al-Madina Karyana Store"
              />
            </Field>
            <Field label="Category">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    className={`chip ${form.category === category.key ? 'chip-active' : ''}`}
                    onClick={() => setForm({ ...form, category: category.key })}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Street address">
              <input
                className="input"
                value={form.addressLine}
                onChange={(event) => setForm({ ...form, addressLine: event.target.value })}
                placeholder="Shop 12, Supply Bazaar Road, Abbottabad"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone">
                <input
                  className="input"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  placeholder="+92 992 000 000"
                />
              </Field>
              <Field label="Minimum order (PKR)">
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={form.minOrder}
                  onChange={(event) => setForm({ ...form, minOrder: Number(event.target.value) })}
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className="input min-h-20"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Fresh stock daily, home delivery across Mandian."
              />
            </Field>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <p className="text-sm text-ink-500">
              Tap the map to drop your pin. Delivery fees are calculated from this point.
            </p>
            <MapView
              center={[pin.lat, pin.lng]}
              zoom={15}
              height="18rem"
              markers={[{ id: 'shop', lat: pin.lat, lng: pin.lng, label: form.name || 'Your shop', kind: 'shop' }]}
              onMapClick={(lat, lng) => setPin({ lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Latitude">
                <input
                  className="input"
                  type="number"
                  step={0.00001}
                  value={pin.lat}
                  onChange={(event) => setPin({ ...pin, lat: Number(event.target.value) })}
                />
              </Field>
              <Field label="Longitude">
                <input
                  className="input"
                  type="number"
                  step={0.00001}
                  value={pin.lng}
                  onChange={(event) => setPin({ ...pin, lng: Number(event.target.value) })}
                />
              </Field>
            </div>
            <Field label="Delivery handled by">
              <select
                className="input"
                value={form.deliveryMode}
                onChange={(event) => setForm({ ...form, deliveryMode: event.target.value })}
              >
                <option value="PLATFORM_RIDER">Qareeb riders</option>
                <option value="SHOP_DELIVERY">My own staff</option>
                <option value="PICKUP">Pickup only</option>
              </select>
            </Field>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="text-sm text-ink-500">
              We create three delivery rings by default (2 km / 4 km / 7 km) — tune them later.
            </p>
            <div className="space-y-2">
              {DAYS.map((day) => (
                <div key={day} className="flex flex-wrap items-center gap-3">
                  <span className="w-24 text-sm font-semibold capitalize text-ink-700">{day}</span>
                  <input
                    type="time"
                    className="input max-w-32"
                    value={hours[day]!.open}
                    onChange={(event) => setHours({ ...hours, [day]: { ...hours[day]!, open: event.target.value } })}
                  />
                  <span className="text-xs text-ink-500">to</span>
                  <input
                    type="time"
                    className="input max-w-32"
                    value={hours[day]!.close}
                    onChange={(event) => setHours({ ...hours, [day]: { ...hours[day]!, close: event.target.value } })}
                  />
                </div>
              ))}
            </div>
            <Field label="Typical preparation time (minutes)">
              <input
                className="input"
                type="number"
                min={5}
                value={form.prepTimeMin}
                onChange={(event) => setForm({ ...form, prepTimeMin: Number(event.target.value) })}
              />
            </Field>
          </>
        ) : null}

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="flex gap-2">
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : null}
          {step < 2 ? (
            <button
              type="button"
              className="btn btn-primary flex-1"
              disabled={step === 0 && (!form.name || !form.addressLine)}
              onClick={() => setStep(step + 1)}
            >
              Continue
            </button>
          ) : (
            <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={finish}>
              {busy ? <Spinner /> : null}
              Create shop
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
