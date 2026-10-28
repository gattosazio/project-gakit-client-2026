'use client';

import { useState } from 'react';
import {
  ChevronDown,
  FileText,
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { STATUS_META } from '@/lib/reports/reportFormatting';
import type { Report, ReportStatus } from '@/types/report';
import { STATUS_ICONS } from './reportFilterOptions';
import { ReportDecisionDialog } from './ReportDecisionDialog';
import type { DecisionReason } from '@/lib/reports/decisionReasons';

function MapPinSearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M 12.248 21.969 a 1 1 0 0 1 -0.849 -0.17 C 9.539 20.193 4 14.993 4 10 a 8 8 0 0 1 16 0 C 20 10.42 19.961 10.841 19.888 11.262" />
      <path d="m22 22-1.88-1.88" />
      <circle cx="12" cy="10" r="3" />
      <circle cx="18" cy="18" r="3" />
    </svg>
  );
}

export function ReportActions({
  report,
  onInspect,
  onViewDetails,
  showInspect = true,
  compact = false,
}: {
  report: Report;
  onInspect: () => void;
  onViewDetails: () => void;
  showInspect?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
      {showInspect && (
        <button
          type="button"
          onClick={onInspect}
          aria-label={compact ? `View report ${report.id.slice(0, 8)} on map` : 'Inspect report on map'}
          title="View on map"
          className={`inline-flex items-center justify-center rounded-lg border border-canvas-grey text-slate-700 hover:border-gakit-maroon hover:text-gakit-maroon ${compact ? 'h-7 w-7' : 'p-2'}`}
        >
          <MapPinSearchIcon className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onViewDetails}
        aria-label={`View report ${report.id.slice(0, 8)} details`}
        title="View report details"
        className={`relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2 ${compact ? 'h-7 w-7 border border-slate-200 text-slate-600 hover:bg-slate-100' : 'h-8 w-28 bg-gakit-maroon px-2.5 text-white hover:bg-maroon-800'}`}
      >
        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className={compact ? 'sr-only' : ''}>View report</span>
      </button>
    </div>
  );
}

export function StatusDropdown({ report, isUpdating, onUpdateStatus, compact = false }: {
  report: Report;
  isUpdating: boolean;
  onUpdateStatus: (report: Report, status: ReportStatus, reason?: DecisionReason) => Promise<boolean>;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const status = STATUS_META[report.status];
  const StatusIcon = STATUS_ICONS[report.status];
  return <>
    <button type="button" onClick={() => setOpen(true)} disabled={isUpdating}
      aria-label={`Update status for report ${report.id.slice(0, 8)}`} aria-haspopup="dialog"
      className={`inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full border font-semibold ${compact ? 'px-1.5 text-[10px]' : 'px-2 text-[11px]'} ${status.badgeClass} disabled:opacity-50`}>
      {isUpdating ? <Spinner size="sm" /> : <>{!compact && <StatusIcon className="h-3.5 w-3.5" />}{status.label}<ChevronDown className="h-3 w-3 opacity-60" /></>}
    </button>
    {open && <ReportDecisionDialog report={report} isUpdating={isUpdating} onClose={() => setOpen(false)}
      onConfirm={(status, reason) => onUpdateStatus(report, status, reason)} />}
  </>;
}
