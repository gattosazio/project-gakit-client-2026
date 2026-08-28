'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  XCircle,
} from 'lucide-react';
import { STATUS_META } from '@/lib/reports/reportFormatting';
import type { Report, ReportStatus } from '@/types/report';
import { STATUS_ICONS } from './reportFilterOptions';

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

/**
 * Slim navigation-only action group: view the report on the map and open its
 * details panel. Status updates live in <StatusDropdown> in the status column.
 */
export function ReportActions({
  report,
  onInspect,
  onViewDetails,
  showInspect = true,
}: {
  report: Report;
  onInspect: () => void;
  onViewDetails: () => void;
  showInspect?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {showInspect && (
        <button
          onClick={onInspect}
          aria-label="Inspect report on map"
          title="View on map"
          className="inline-flex items-center justify-center rounded-lg border border-canvas-grey p-2 text-slate-700 hover:border-gakit-maroon hover:text-gakit-maroon"
        >
          <MapPinSearchIcon className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={onViewDetails}
        aria-label="View report details"
        title="View details"
        className="inline-flex items-center justify-center rounded-lg border border-canvas-grey p-2 text-slate-700 hover:border-gakit-maroon hover:text-gakit-maroon"
      >
        <Info className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Quick status updater rendered in the status column. The status pill itself
 * is the trigger and doubles as the current-state readout.
 */
export function StatusDropdown({
  report,
  isUpdating,
  onUpdateStatus,
}: {
  report: Report;
  isUpdating: boolean;
  onUpdateStatus: (report: Report, toStatus: ReportStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const status = STATUS_META[report.status];
  const StatusIcon = STATUS_ICONS[report.status];
  const options: Array<{
    status: ReportStatus;
    label: string;
    className: string;
    icon: typeof CheckCircle2;
  }> = [
    { status: 'VERIFIED', label: 'Verify', className: 'text-hazard-safe', icon: CheckCircle2 },
    { status: 'ANOMALY', label: 'Flag for review', className: 'text-hazard-critical', icon: AlertTriangle },
    { status: 'REJECTED', label: 'Reject', className: 'text-slate-600', icon: XCircle },
  ];

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 176;
      setMenuPos({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      });
    }
    setOpen(true);
  };

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        disabled={isUpdating}
        aria-label={`Update status for report ${report.id.slice(0, 8)}`}
        title={`${status.label} · Update status`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${status.badgeClass} hover:brightness-95 disabled:cursor-wait disabled:opacity-60`}
      >
        {isUpdating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <StatusIcon className="h-4 w-4" style={{ color: status.color }} />
            {status.label}
            <ChevronDown
              className={`h-3.5 w-3.5 text-current opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {open &&
        createPortal(
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="fixed inset-0 z-[1300] cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              role="menu"
              style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: 176 }}
              className="z-[1400] overflow-hidden rounded-lg border border-canvas-grey bg-white shadow-lg"
            >
              {options.map((option, index) => {
                const isCurrent = report.status === option.status;
                const Icon = option.icon;
                return (
                  <button
                    key={option.status}
                    role="menuitem"
                    disabled={isCurrent}
                    onClick={() => {
                      if (option.status === 'REJECTED' && !window.confirm('Reject this report?')) return;
                      setOpen(false);
                      onUpdateStatus(report, option.status);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-canvas-light disabled:cursor-not-allowed disabled:opacity-50 ${index > 0 ? 'border-t border-canvas-grey' : ''} ${option.className}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{option.label}</span>
                    {isCurrent && <span className="text-xs font-medium text-slate-400">Current</span>}
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}