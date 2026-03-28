'use client';

import { useState } from 'react';

interface DateRangeFilterProps {
  onFilter: (from: string | null, to: string | null) => void;
}

export default function DateRangeFilter({ onFilter }: DateRangeFilterProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [open, setOpen] = useState(false);

  function apply() {
    onFilter(from || null, to || null);
    setOpen(false);
  }

  function clear() {
    setFrom('');
    setTo('');
    onFilter(null, null);
    setOpen(false);
  }

  const hasFilter = from || to;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
          hasFilter
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
        }`}
      >
        📅 {hasFilter ? 'Filtered' : 'Date range'}
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50 w-72">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={apply}
                className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Apply
              </button>
              {hasFilter && (
                <button
                  onClick={clear}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
