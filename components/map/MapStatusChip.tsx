'use client';

import { Loader2 } from 'lucide-react';
import type { BackendStatus } from '@/lib/backend/backendStatus';

interface MapStatusChipProps {
  backendStatus: BackendStatus;
  showLoading: boolean;
  showEmptyState: boolean;
  reportWindowHours?: number | null;
}

function formatEmptyStateText(hours?: number | null): string {
  if (hours === null) return 'No flood reports in this area';
  if (hours === undefined || hours === 48) return 'No flood reports in the last 48 hours';
  if (hours === 24) return 'No flood reports in the last 24 hours';
  if (hours % 24 === 0 && hours > 48) {
    return `No flood reports in the last ${hours / 24} days`;
  }
  return `No flood reports in the last ${hours} hours`;
}

// Non-blocking status chip anchored to the map's bottom-left corner. Shows a
// "loading reports" state while the first fetch is in flight, a friendly
// "server is waking up" state while the backend is cold-starting (free tier)
// instead of a silent failure, and an empty state once a load completed with
// no reports in the area.
export function MapStatusChip({
  backendStatus,
  showLoading,
  showEmptyState,
  reportWindowHours,
}: MapStatusChipProps) {
  if (backendStatus === 'warming') {
    return (
      <div className="absolute bottom-8 left-3 z-[1000] flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 shadow-lg ring-1 ring-amber-200">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span>Server is waking up — retrying…</span>
      </div>
    );
  }

  if (showLoading) {
    return (
      <div className="absolute bottom-8 left-3 z-[1000] flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow-lg ring-1 ring-slate-200">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span>Loading flood reports…</span>
      </div>
    );
  }

  if (showEmptyState) {
    return (
      <div className="absolute bottom-8 left-3 z-[1000] rounded-lg bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow-lg ring-1 ring-slate-200">
        {formatEmptyStateText(reportWindowHours)}
      </div>
    );
  }

  return null;
}
