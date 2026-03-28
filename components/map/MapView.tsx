'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Map, { Marker, Popup, type MapRef } from 'react-map-gl/mapbox';
import { createClient } from '@/lib/supabase/client';
import { mapThumbnailUrl } from '@/lib/cloudinary';
import MemoryDetail from '@/components/memory/MemoryDetail';
import MapSearch from '@/components/map/MapSearch';
import type { Memory } from '@/lib/types';
import 'mapbox-gl/dist/mapbox-gl.css';

export default function MapView() {
  const mapRef = useRef<MapRef>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [detailMemory, setDetailMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchMemories = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMemories(data);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleMarkerClick = useCallback((memory: Memory, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedMemory(memory);
  }, []);

  const handleMapClick = useCallback(() => {
    setSelectedMemory(null);
  }, []);

  const handleSearchSelect = useCallback((lng: number, lat: number, _placeName: string) => {
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 12,
      duration: 2000,
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] relative">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: memories[0]?.longitude || -98.5,
            latitude: memories[0]?.latitude || 39.8,
            zoom: memories.length > 0 ? 4 : 3,
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          onClick={handleMapClick}
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
              <div
                className="cursor-pointer transition-transform hover:scale-110"
                onClick={(e) => handleMarkerClick(memory, e)}
              >
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
              className="memory-popup"
            >
              <div
                className="cursor-pointer min-w-[200px]"
                onClick={() => {
                  setDetailMemory(selectedMemory);
                  setSelectedMemory(null);
                }}
              >
                <img
                  src={mapThumbnailUrl(selectedMemory.photo_public_id)}
                  alt={selectedMemory.caption}
                  className="w-full h-32 object-cover rounded-lg mb-2"
                />
                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                  {selectedMemory.caption || 'No caption'}
                </p>
                {selectedMemory.taken_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(selectedMemory.taken_at).toLocaleDateString()}
                  </p>
                )}
                <p className="text-xs text-blue-600 mt-1">Tap to view →</p>
              </div>
            </Popup>
          )}
        </Map>

        {/* Location search */}
        <MapSearch onSelect={handleSearchSelect} />

        {/* Empty state overlay */}
        {memories.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 backdrop-blur rounded-2xl p-8 text-center shadow-lg pointer-events-auto">
              <p className="text-5xl mb-3">📸</p>
              <h3 className="text-lg font-semibold text-gray-900">No memories yet</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">Upload your first photo to see it on the map</p>
              <a
                href="/upload"
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition font-medium"
              >
                Upload a photo
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailMemory && (
        <MemoryDetail
          memory={detailMemory}
          onClose={() => setDetailMemory(null)}
          onUpdate={(updated) => {
            setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            setDetailMemory(updated);
          }}
          onDelete={(id) => {
            setMemories((prev) => prev.filter((m) => m.id !== id));
            setDetailMemory(null);
          }}
        />
      )}
    </>
  );
}
