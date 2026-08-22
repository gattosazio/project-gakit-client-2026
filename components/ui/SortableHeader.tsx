'use client';

import { ChevronDown } from 'lucide-react';
import type { SortState } from '@/hooks/useSortableTable';

export function SortableHeader<Column extends string>({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: Column;
  sort: SortState<Column>;
  onSort: (column: Column) => void;
}) {
  return (
    <th className="px-6 py-3 font-semibold text-left">
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-slate-900"
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${
            sort.column === column && sort.direction === 'asc'
              ? 'rotate-180'
              : ''
          }`}
        />
      </button>
    </th>
  );
}
