'use client';

import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, FileImage, X, XCircle } from 'lucide-react';
import { DEPTH_LABELS, STATUS_META, formatDateTime } from '@/lib/reportFormatting';
import type { Report, ReportStatus } from '@/types/report';
import { useState, useRef } from 'react';

export function ReportDetail({
  report,
  isUpdating,
  onClose,
  onUpdateStatus,
  modal = false,
}: {
  report: Report;
  isUpdating: boolean;
  onClose: () => void;
  onUpdateStatus: (report: Report, toStatus: ReportStatus) => void;
  modal?: boolean;
}) {
  const status = STATUS_META[report.status];
  const address = report.location.address || `${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`;
  const content = (
    <div className={modal ? 'max-h-[85vh] overflow-y-auto' : ''}>
      <div className="flex items-start justify-between gap-3 border-b border-canvas-grey p-5">
        <div>
          <h3 className="font-bold text-slate-900">Report Details</h3>
          <p className="mt-1 break-all text-sm text-slate-500">{report.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badgeClass}`}>
            {status.label}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report details"
            className="rounded-lg border border-canvas-grey p-2 text-slate-500 hover:bg-canvas-light hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex aspect-video items-center justify-center rounded-lg border border-canvas-grey bg-canvas-light">
          <div className="text-center">
            <FileImage className="mx-auto h-8 w-8 text-slate-300" />
            <div className="mt-2 text-sm font-semibold text-slate-500">No photo submitted</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailItem label="Location" value={address} />
          <DetailItem label="Depth" value={DEPTH_LABELS[report.depth.code]} />
          <DetailItem label="Status" value={status.label} />
          <DetailItem label="Coordinates" value={`${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`} />
          <DetailItem label="Submitted" value={formatDateTime(report.createdAt)} />
          <DetailItem label="Observed" value={formatDateTime(report.observedAt)} />
        </div>

        <StatusActionMenu report={report} isUpdating={isUpdating} onUpdateStatus={onUpdateStatus} />
      </div>
    </div>
  );

  if (modal) {
    return createPortal(
      <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center sm:p-6">
        <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">{content}</div>
      </div>,
      document.body
    );
  }

  return <aside className="overflow-hidden rounded-lg border border-canvas-grey bg-white shadow-sm">{content}</aside>;
}

function StatusActionMenu({
  report,
  isUpdating,
  onUpdateStatus,
}: {
  report: Report;
  isUpdating: boolean;
  onUpdateStatus: (report: Report, toStatus: ReportStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ bottom: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const options: Array<{ status: ReportStatus; label: string; className: string; icon: typeof CheckCircle2 }> = [
    { status: 'VERIFIED', label: 'Verify', className: 'text-hazard-safe', icon: CheckCircle2 },
    { status: 'ANOMALY', label: 'Mark Anomaly', className: 'text-hazard-critical', icon: AlertTriangle },
    { status: 'REJECTED', label: 'Reject', className: 'text-slate-600', icon: XCircle },
  ];

  const toggle = () => {
    if (open) return setOpen(false);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width });
    setOpen(true);
  };

  return (
    <>
      <button ref={buttonRef} type="button" onClick={toggle} disabled={isUpdating} aria-haspopup="menu" aria-expanded={open} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-4 py-3 text-sm font-semibold text-white hover:bg-maroon-800 disabled:opacity-50">
        {isUpdating ? 'Updating...' : 'Update Status'}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
      {open && createPortal(
        <>
          <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-[1300]" onClick={() => setOpen(false)} />
          <div role="menu" style={{ position: 'fixed', bottom: menuPos.bottom, left: menuPos.left, width: menuPos.width }} className="z-[1400] overflow-hidden rounded-lg border border-canvas-grey bg-white shadow-lg">
            {options.map((option, index) => {
              const isCurrent = report.status === option.status;
              const Icon = option.icon;
              return <button key={option.status} role="menuitem" disabled={isCurrent} onClick={() => { setOpen(false); onUpdateStatus(report, option.status); }} className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-canvas-light disabled:opacity-50 ${index > 0 ? 'border-t border-canvas-grey' : ''} ${option.className}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{option.label}</span>
                {isCurrent && <span className="text-xs font-medium text-slate-400">Current</span>}
              </button>;
            })}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-semibold text-slate-500">{label}</div><div className="mt-1 font-medium text-slate-900">{value}</div></div>;
}
