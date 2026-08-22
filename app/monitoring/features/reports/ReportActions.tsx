'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Eye,
  Info,
  Loader2,
  XCircle,
} from 'lucide-react';
import { STATUS_META } from '@/lib/reports/reportFormatting';
import type { Report, ReportStatus } from '@/types/report';
import { STATUS_ICONS } from './reportFilterOptions';

export function ReportActions({
  report,
  isUpdating,
  onInspect,
  onViewDetails,
  onUpdateStatus,
  showInspect = true,
}: {
  report: Report;
  isUpdating: boolean;
  onInspect: () => void;
  onViewDetails: () => void;
  onUpdateStatus: (report: Report, toStatus: ReportStatus) => void;
  showInspect?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
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
  const StatusIcon = STATUS_ICONS[report.status];

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
    <div className="flex items-center gap-2">
      {showInspect && (
        <button
          onClick={onInspect}
          aria-label="Inspect report on map"
          title="View on map"
          className="inline-flex items-center justify-center rounded-lg border border-canvas-grey p-2 text-slate-700 hover:border-gakit-maroon hover:text-gakit-maroon"
        >
          <Eye className="h-4 w-4" />
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
      <div>
        <button
          ref={buttonRef}
          type="button"
          onClick={toggle}
          disabled={isUpdating}
          aria-label={`Update status for report ${report.id.slice(0, 8)}`}
          title="Update status"
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex items-center gap-0.5 rounded-lg border border-canvas-grey px-2 py-2 text-slate-600 hover:border-gakit-maroon hover:text-gakit-maroon disabled:opacity-50"
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <StatusIcon className="h-4 w-4" style={{ color: STATUS_META[report.status].color }} />
              <ChevronDown className="h-3 w-3 text-slate-400" />
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
    </div>
  );
}
