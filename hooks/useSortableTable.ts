'use client';

import { useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState<Column extends string> {
  column: Column;
  direction: SortDirection;
}

/**
 * Shared single-column sort state: clicking a column sorts descending the
 * first time and toggles back to ascending when it is already sorted desc.
 */
export function useSortableTable<Column extends string>(
  initial: SortState<Column>
) {
  const [sort, setSort] = useState<SortState<Column>>(initial);

  const toggleSort = (column: Column) => {
    setSort((current) => ({
      column,
      direction:
        current.column === column && current.direction === 'desc'
          ? 'asc'
          : 'desc',
    }));
  };

  return { sort, toggleSort };
}
