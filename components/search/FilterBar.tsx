'use client';

import SearchBar from '@/components/search/SearchBar';
import DateRangeFilter from '@/components/search/DateRangeFilter';
import type { MemoryFilters } from '@/lib/types';

interface FilterBarProps {
  filters: MemoryFilters;
  onFiltersChange: (filters: MemoryFilters) => void;
}

export default function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-1">
        <SearchBar
          onSearch={(search) => onFiltersChange({ ...filters, search: search || undefined })}
        />
      </div>
      <DateRangeFilter
        onFilter={(dateFrom, dateTo) =>
          onFiltersChange({
            ...filters,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          })
        }
      />
    </div>
  );
}
