'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ReportsPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'reports',
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="border-t border-canvas-grey px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-500">
        Showing {startItem}-{endItem} of {totalItems} {itemLabel}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="inline-flex items-center gap-2 rounded-lg border border-canvas-grey px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2 text-sm font-semibold text-slate-700">
          Page {currentPage} of {totalPages}
        </div>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages || totalPages === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-canvas-grey px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
