import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind?: 'shop' | 'rider' | 'home' | 'destination';
  onSelect?: () => void;
  selected?: boolean;
};

export type MapRing = { id: string; lat: number; lng: number; radiusKm: number };

const COLORS: Record<string, string> = {
  shop: '#225740',
  rider: '#b98900',
  home: '#c2703a',
  destination: '#102e22',
};

function pinIcon(kind: string, label: string, selected: boolean) {
  const color = COLORS[kind] ?? COLORS.shop;
  const size = kind === 'rider' ? 30 : selected ? 36 : 30;
  return L.divIcon({
    className: '',
    html: `<div class="qareeb-pin" title="${label.replace(/"/g, '')}" style="width:${size}px;height:${size}px;background:${color};color:#fdfbf6">
             <span>${kind === 'rider' ? '▲' : kind === 'home' ? '⌂' : '•'}</span>
           </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function MapController({ center, follow }: { center: [number, number]; follow?: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (follow) map.panTo(follow, { animate: true, duration: 0.8 });
  }, [follow, map]);
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: false });
    // recentre only when the search centre itself changes
  }, [center[0], center[1], map]);
  return null;
}

export default function MapView({
  center,
  markers,
  rings = [],
  path,
  zoom = 14,
  follow = null,
  height = '18rem',
  onMapClick,
}: {
  center: [number, number];
  markers: MapMarker[];
  rings?: MapRing[];
  path?: [number, number][];
  zoom?: number;
  follow?: [number, number] | null;
  height?: string;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  const icons = useMemo(
    () => markers.map((marker) => pinIcon(marker.kind ?? 'shop', marker.label, Boolean(marker.selected))),
    [markers],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-cream-300" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        attributionControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          subdomains={['a', 'b', 'c', 'd']}
        />
        <ClickCapture onMapClick={onMapClick} />
        {rings.map((ring) => (
          <Circle
            key={ring.id}
            center={[ring.lat, ring.lng]}
            radius={ring.radiusKm * 1000}
            pathOptions={{ color: '#4d9173', weight: 1, fillColor: '#7db497', fillOpacity: 0.08 }}
          />
        ))}
        {path && path.length > 1 ? (
          <Polyline positions={path} pathOptions={{ color: '#225740', weight: 4, dashArray: '6 8' }} />
        ) : null}
        {markers.map((marker, index) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={icons[index]!}
            eventHandlers={marker.onSelect ? { click: marker.onSelect } : undefined}
          />
        ))}
        <MapController center={center} follow={follow} />
      </MapContainer>
    </div>
  );
}

function ClickCapture({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onMapClick) return;
    const handler = (event: L.LeafletMouseEvent) => onMapClick(event.latlng.lat, event.latlng.lng);
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [map, onMapClick]);
  return null;
}
