'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { feedCardUrl } from '@/lib/cloudinary';
import MemoryDetail from '@/components/memory/MemoryDetail';
import FilterBar from '@/components/search/FilterBar';
import type { Memory, MemoryFilters } from '@/lib/types';

const PAGE_SIZE = 12;

export default function FeedList() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [detailMemory, setDetailMemory] = useState<Memory | null>(null);
  const [filters, setFilters] = useState<MemoryFilters>({});
  const supabase = createClient();

  const fetchMemories = useCallback(async (offset: number = 0, currentFilters?: MemoryFilters) => {
    const f = currentFilters ?? filters;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from('memories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Apply search filter
    if (f.search) {
      query = query.textSearch('caption', f.search, { type: 'websearch' });
    }

    // Apply date filters
    if (f.dateFrom) {
      query = query.gte('taken_at', f.dateFrom);
    }
    if (f.dateTo) {
      query = query.lte('taken_at', f.dateTo + 'T23:59:59');
    }

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);

    if (!error && data) {
      if (offset === 0) {
        setMemories(data);
      } else {
        setMemories((prev) => [...prev, ...data]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [supabase, filters]);

  useEffect(() => {
    setLoading(true);
    fetchMemories(0, filters);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    fetchMemories(memories.length);
  }, [fetchMemories, memories.length]);

  const handleFiltersChange = useCallback((newFilters: MemoryFilters) => {
    setFilters(newFilters);
  }, []);

  return (
    <>
      <div className="mb-6">
        <FilterBar filters={filters} onFiltersChange={handleFiltersChange} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : memories.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">📸</p>
          <h3 className="text-lg font-semibold text-gray-900">
            {filters.search || filters.dateFrom || filters.dateTo
              ? 'No memories match your filters'
              : 'No memories yet'}
          </h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            {filters.search || filters.dateFrom || filters.dateTo
              ? 'Try adjusting your search or date range'
              : 'Upload your first photo to start your feed'}
          </p>
          {!filters.search && !filters.dateFrom && !filters.dateTo && (
            <a
              href="/upload"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition font-medium"
            >
              Upload a photo
            </a>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {memories.map((memory) => (
              <div
                key={memory.id}
                onClick={() => setDetailMemory(memory)}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition group"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={feedCardUrl(memory.photo_public_id)}
                    alt={memory.caption}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-2 right-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      memory.visibility === 'public'
                        ? 'bg-green-100/90 text-green-700'
                        : memory.visibility === 'link'
                        ? 'bg-blue-100/90 text-blue-700'
                        : 'bg-gray-100/90 text-gray-600'
                    }`}>
                      {memory.visibility === 'public' ? '🌍' : memory.visibility === 'link' ? '🔗' : '🔒'}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-gray-900 font-medium line-clamp-2">
                    {memory.caption || 'No caption'}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    {memory.taken_at && (
                      <span>📅 {new Date(memory.taken_at).toLocaleDateString()}</span>
                    )}
                    <span>📍 {memory.latitude.toFixed(2)}, {memory.longitude.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="text-center py-8">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition font-medium"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

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
