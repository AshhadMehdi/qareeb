import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PickupPoint = {
  label: string;
  line1: string;
  area: string | null;
  lat: number;
  lng: number;
  source: 'address' | 'gps' | 'default';
  addressId?: string | null;
};

/** The centre of Abbottabad — used until a customer shares an address. */
export const ABBOTTABAD_CENTER: PickupPoint = {
  label: 'Abbottabad',
  line1: 'Fawara Chowk',
  area: 'Cantt',
  lat: 34.1688,
  lng: 73.2215,
  source: 'default',
  addressId: null,
};

type LocationState = {
  point: PickupPoint;
  locating: boolean;
  error: string | null;
  setPoint: (point: PickupPoint) => void;
  setFromAddress: (address: { id: string; label: string; line1: string; area: string | null; lat: number; lng: number }) => void;
  useGps: () => Promise<PickupPoint | null>;
  reset: () => void;
};

export const useLocation = create<LocationState>()(
  persist(
    (set) => ({
      point: ABBOTTABAD_CENTER,
      locating: false,
      error: null,

      setPoint: (point) => set({ point }),

      setFromAddress: (address) =>
        set({
          point: {
            label: address.label,
            line1: address.line1,
            area: address.area,
            lat: address.lat,
            lng: address.lng,
            source: 'address',
            addressId: address.id,
          },
          error: null,
        }),

      useGps: async () => {
        if (!('geolocation' in navigator)) {
          set({ error: 'This browser cannot share a location' });
          return null;
        }
        set({ locating: true, error: null });
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 60_000,
            });
          });
          const point: PickupPoint = {
            label: 'Current location',
            line1: 'Shared from your device',
            area: null,
            lat: Number(position.coords.latitude.toFixed(5)),
            lng: Number(position.coords.longitude.toFixed(5)),
            source: 'gps',
            addressId: null,
          };
          set({ point, locating: false });
          return point;
        } catch {
          set({ locating: false, error: 'Location permission was not granted' });
          return null;
        }
      },

      reset: () => set({ point: ABBOTTABAD_CENTER, error: null }),
    }),
    { name: 'qareeb.location' },
  ),
);
