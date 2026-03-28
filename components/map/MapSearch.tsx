'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface GeocoderResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface MapSearchProps {
  onSelect: (lng: number, lat: number, placeName: string) => void;
}

export default function MapSearch({ onSelect }: MapSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocoderResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&access_token=${token}&limit=5&language=en`
      );
      const data = await res.json();

      if (data.features) {
        const mapped: GeocoderResult[] = data.features.map((f: any) => ({
          id: f.id,
          place_name: f.properties.full_address || f.properties.name,
          center: f.geometry.coordinates as [number, number],
        }));
        setResults(mapped);
        setOpen(mapped.length > 0);
      }
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  }, [search]);

  const handleSelect = useCallback((result: GeocoderResult) => {
    setQuery(result.place_name);
    setOpen(false);
    setResults([]);
    onSelect(result.center[0], result.center[1], result.place_name);
  }, [onSelect]);

  return (
    <div ref={containerRef} className="absolute top-4 left-4 z-10 w-80 max-w-[calc(100vw-2rem)]">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search for a place..."
          className="w-full pl-10 pr-10 py-3 rounded-xl bg-white shadow-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm text-gray-900"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
        {query && !loading && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="mt-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 transition text-sm border-b border-gray-100 last:border-b-0"
            >
              <span className="text-gray-400 mr-2">📍</span>
              <span className="text-gray-900">{result.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
