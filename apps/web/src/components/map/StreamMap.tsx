import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationStats } from '@tracearr/shared';
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Fix for default marker icons in Leaflet with bundlers
delete (L.Icon.Default.prototype as { _getIconUrl?: () => void })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom popup styles for dark theme
const popupStyles = `
  .leaflet-popup-content-wrapper {
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    padding: 0;
  }
  .leaflet-popup-content {
    margin: 0 !important;
    min-width: 180px;
    max-width: 240px;
  }
  .leaflet-popup-tip {
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-top: none;
    border-right: none;
  }
  .leaflet-popup-close-button {
    color: hsl(var(--muted-foreground)) !important;
    font-size: 18px !important;
    padding: 4px 8px !important;
  }
  .leaflet-popup-close-button:hover {
    color: hsl(var(--foreground)) !important;
  }
`;

interface StreamMapProps {
  locations: LocationStats[];
  className?: string;
  isLoading?: boolean;
}

// Calculate marker radius based on count (min 6, max 30)
function getMarkerRadius(count: number, maxCount: number): number {
  if (maxCount === 0) return 8;
  const normalized = count / maxCount;
  return Math.max(6, Math.min(30, 6 + normalized * 24));
}

// Component to fit bounds when data changes
function MapBoundsUpdater({ locations }: { locations: LocationStats[] }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = locations
      .filter((l) => l.lat && l.lon)
      .map((l) => [l.lat, l.lon]);

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
    } else {
      // Default view when no data
      map.setView([20, 0], 2);
    }
  }, [locations, map]);

  return null;
}

export function StreamMap({ locations, className, isLoading }: StreamMapProps) {
  // Calculate max count for marker sizing
  const maxCount = useMemo(
    () => Math.max(...locations.map((l) => l.count), 1),
    [locations]
  );

  const hasData = locations.length > 0;

  return (
    <div className={cn('relative h-full w-full', className)}>
      <style>{popupStyles}</style>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        className="h-full w-full"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapBoundsUpdater locations={locations} />

        {/* Location markers */}
        {locations.map((location, idx) => {
          if (!location.lat || !location.lon) return null;

          const radius = getMarkerRadius(location.count, maxCount);
          const locationKey = `${location.city}-${location.country}-${location.lat}-${location.lon}-${idx}`;

          return (
            <CircleMarker
              key={locationKey}
              center={[location.lat, location.lon]}
              radius={radius}
              pathOptions={{
                fillColor: 'hsl(199, 89%, 48%)', // cyan-500
                fillOpacity: 0.7,
                color: 'hsl(199, 89%, 60%)',
                weight: 2,
              }}
            >
              <Popup>
                <div className="p-3 text-foreground">
                  {/* Location header */}
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-cyan-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {location.city || 'Unknown City'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {location.country || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 space-y-1.5 border-t border-border pt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Streams</span>
                      <span className="font-medium tabular-nums">{location.count}</span>
                    </div>
                    {location.lastActivity && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Last activity</span>
                        <span className="text-xs">
                          {formatDistanceToNow(new Date(location.lastActivity), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading map data...
          </div>
        </div>
      )}

      {/* No data message */}
      {!isLoading && !hasData && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <p className="text-sm text-muted-foreground">No location data for current filters</p>
        </div>
      )}
    </div>
  );
}
