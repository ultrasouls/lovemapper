'use client';

import { useState } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/mapbox';
import { mapThumbnailUrl, fullResUrl } from '@/lib/cloudinary';
import type { Memory } from '@/lib/types';
import 'mapbox-gl/dist/mapbox-gl.css';

interface PublicProfileMapProps {
  memories: Memory[];
  username: string;
}

export default function PublicProfileMap({ memories, username }: PublicProfileMapProps) {
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  if (memories.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-5xl mb-3">🗺️</p>
          <h3 className="text-lg font-semibold text-gray-900">No public memories</h3>
          <p className="text-sm text-gray-500 mt-1">@{username} hasn&apos;t shared any memories publicly yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 130px)' }}>
      <Map
        initialViewState={{
          longitude: memories[0]?.longitude || 0,
          latitude: memories[0]?.latitude || 30,
          zoom: memories.length === 1 ? 10 : 3,
        }}
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
            <div className="min-w-[200px]">
              <img
                src={fullResUrl(selectedMemory.photo_public_id)}
                alt={selectedMemory.caption}
                className="w-full h-32 object-cover rounded-lg mb-2"
              />
              <p className="text-sm font-medium text-gray-900 line-clamp-2">
                {selectedMemory.caption || 'No caption'}
              </p>
              {selectedMemory.taken_at && (
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(selectedMemory.taken_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
