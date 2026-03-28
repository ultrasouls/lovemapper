'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Map, { Marker, Popup, type MapRef } from 'react-map-gl/mapbox';
import { createClient } from '@/lib/supabase/client';
import { mapThumbnailUrl, fullResUrl } from '@/lib/cloudinary';
import MapSearch from '@/components/map/MapSearch';
import type { MemoryWithProfile } from '@/lib/types';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function ExploreMap() {
  const mapRef = useRef<MapRef>(null);
  const [memories, setMemories] = useState<MemoryWithProfile[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<MemoryWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchPublicMemories = useCallback(async () => {
    const { data, error } = await supabase
      .from('memories')
      .select('*, profiles(username, avatar_url)')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) {
      setMemories(data as MemoryWithProfile[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchPublicMemories();
  }, [fetchPublicMemories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] relative">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -40, latitude: 30, zoom: 2 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        onClick={() => setSelectedMemory(null)}
      >
        {memories.map((memory) => (
          <Marker
            key={memory.id}
            longitude={memory.longitude}
            latitude={memory.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedMemory(memory);
            }}
          >
            <div className="cursor-pointer transition-transform hover:scale-110">
              <div className="w-10 h-10 rounded-full border-2 border-white shadow-lg overflow-hidden bg-gray-200">
                <img
                  src={mapThumbnailUrl(memory.photo_public_id)}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white mx-auto -mt-0.5" />
            </div>
          </Marker>
        ))}

        {selectedMemory && (
          <Popup
            longitude={selectedMemory.longitude}
            latitude={selectedMemory.latitude}
            anchor="bottom"
            offset={50}
            onClose={() => setSelectedMemory(null)}
            closeButton={true}
            closeOnClick={false}
          >
            <div className="min-w-[220px]">
              <img
                src={fullResUrl(selectedMemory.photo_public_id)}
                alt={selectedMemory.caption}
                className="w-full h-36 object-cover rounded-lg mb-2"
              />
              <p className="text-sm font-medium text-gray-900 line-clamp-2">
                {selectedMemory.caption || 'No caption'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">
                  by @{selectedMemory.profiles?.username || 'unknown'}
                </span>
                {selectedMemory.taken_at && (
                  <span className="text-xs text-gray-400">
                    · {new Date(selectedMemory.taken_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Location search */}
      <MapSearch onSelect={(lng, lat) => {
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 12, duration: 2000 });
      }} />

      {memories.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur rounded-2xl p-8 text-center shadow-lg">
            <p className="text-5xl mb-3">🌍</p>
            <h3 className="text-lg font-semibold text-gray-900">No public memories yet</h3>
            <p className="text-sm text-gray-500 mt-1">Be the first to share a memory with the world!</p>
          </div>
        </div>
      )}
    </div>
  );
}
