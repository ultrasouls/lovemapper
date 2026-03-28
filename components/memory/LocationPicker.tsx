'use client';

import { useState, useCallback, useRef } from 'react';
import Map, { Marker, type MapRef, type MapMouseEvent } from 'react-map-gl/mapbox';
import MapSearch from '@/components/map/MapSearch';
import 'mapbox-gl/dist/mapbox-gl.css';

interface LocationPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onLocationSet: (lat: number, lng: number) => void;
}

export default function LocationPicker({ initialLat, initialLng, onLocationSet }: LocationPickerProps) {
  const mapRef = useRef<MapRef>(null);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );

  const handleClick = useCallback((e: MapMouseEvent) => {
    const { lng, lat } = e.lngLat;
    setMarker({ lat, lng });
  }, []);

  const handleSearchSelect = useCallback((lng: number, lat: number, _placeName: string) => {
    // Fly to the searched location and drop a pin there
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 14,
      duration: 1500,
    });
    setMarker({ lat, lng });
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden border border-gray-200 relative" style={{ height: '400px' }}>
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: initialLng || -98.5,
            latitude: initialLat || 39.8,
            zoom: initialLat ? 12 : 3,
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          onClick={handleClick}
          cursor="crosshair"
        >
          {marker && (
            <Marker
              longitude={marker.lng}
              latitude={marker.lat}
              anchor="bottom"
            >
              <div className="text-3xl animate-bounce">📍</div>
            </Marker>
          )}
        </Map>

        {/* Location search overlay */}
        <MapSearch onSelect={handleSearchSelect} />
      </div>

      {marker && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
          </p>
          <button
            onClick={() => onLocationSet(marker.lat, marker.lng)}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition font-medium"
          >
            Confirm location
          </button>
        </div>
      )}
    </div>
  );
}
