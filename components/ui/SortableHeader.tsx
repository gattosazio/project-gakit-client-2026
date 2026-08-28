'use client';

import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
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
  const isActive = sort.column === column;
  return (
    <th className="px-6 py-3 font-semibold text-left">
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-slate-900"
      >
        {label}
        {isActive ? (
          sort.direction === 'asc' ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300" />
        )}
      </button>
    </th>
  );
}
