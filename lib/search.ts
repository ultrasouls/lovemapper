import type { MemoryFilters } from '@/lib/types';

/**
 * Build a Supabase query filter string for memories.
 * This is used as a helper — actual query building happens inline
 * in components since Supabase's chained builder doesn't expose
 * a generic enough type for a standalone helper.
 */
export function buildFilterDescription(filters: MemoryFilters): string {
  const parts: string[] = [];
  if (filters.search) parts.push(`search: "${filters.search}"`);
  if (filters.dateFrom) parts.push(`from: ${filters.dateFrom}`);
  if (filters.dateTo) parts.push(`to: ${filters.dateTo}`);
  if (filters.bounds) parts.push('within map bounds');
  return parts.length > 0 ? parts.join(', ') : 'no filters';
}
