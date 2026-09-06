'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  MapPin,
  X,
  XCircle,
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import {
  DEPTH_LABELS,
  REFERENCE_LABELS,
  STATUS_META,
  formatDateTime,
  formatReportDepth,
} from '@/lib/reports/reportFormatting';
import { getElevation } from '@/lib/map/elevation';
import type { Report, ReportStatus } from '@/types/report';

const CLOSE_MS = 160;

export function ReportDetail({
  report,
  isUpdating,
  onClose,
  onUpdateStatus,
  onViewOnMap,
  modal = false,
}: {
  report: Report;
  isUpdating: boolean;
  onClose: () => void;
  onUpdateStatus: (report: Report, toStatus: ReportStatus, reason?: string) => void;
  onViewOnMap?: () => void;
  modal?: boolean;
}) {
  const status = STATUS_META[report.status];
  const address = report.location.address || `${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`;
  const [elevation, setElevation] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCoord, setCopiedCoord] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getElevation(report.location.latitude, report.location.longitude).then((elev) => {
      if (!cancelled) setElevation(elev);
    });
    return () => {
      cancelled = true;
    };
  }, [report.location.latitude, report.location.longitude]);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }, [closing, onClose]);

  useEffect(() => {
    if (!modal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modal, requestClose]);

  // Focus the dialog on open and restore on close; lock body scroll while open.
  useEffect(() => {
    if (!modal) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus?.();
    };
  }, [modal]);

  const copyText = async (text: string, target: 'id' | 'coord') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(ta);
      }
    }
    if (target === 'id') {
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 1500);
    } else {
      setCopiedCoord(true);
      window.setTimeout(() => setCopiedCoord(false), 1500);
    }
  };

  const coordinates = `${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`;

  const content = (
    <div className={modal ? 'max-h-[85vh] overflow-y-auto overscroll-contain' : ''}>
      <div className="flex items-start justify-between gap-3 border-b border-canvas-grey p-5">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900">Report Details</h3>
          <div className="mt-1 flex items-center gap-1.5">
            <p className="truncate font-mono text-sm text-slate-500">{report.id}</p>
            <button
              type="button"
              onClick={() => copyText(report.id, 'id')}
              aria-label="Copy report ID"
              title="Copy report ID"
              className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-canvas-light hover:text-slate-700"
            >
              {copiedId ? <Check className="h-3.5 w-3.5 text-hazard-safe" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badgeClass}`}>
            {status.label}
          </span>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close report details"
            className="rounded-lg border border-canvas-grey p-2 text-slate-500 hover:bg-canvas-light hover:text-slate-900 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <LocationPreview
          address={address}
          coordinates={coordinates}
          copied={copiedCoord}
          onCopy={() => copyText(coordinates, 'coord')}
          onViewOnMap={onViewOnMap}
        />

        <FieldGroup title="Flood report">
          <DetailItem label="Depth" value={formatReportDepth(report.depth, report.depthCm)} />
          {report.reference ? (
            <DetailItem label="Reference" value={REFERENCE_LABELS[report.reference] || report.reference} />
          ) : (
            <DetailItem label="Reference" value="—" />
          )}
          <DetailItem label="Status" value={status.label} />
          <DetailItem
            label="Elevation"
            loading={elevation == null}
            value={elevation != null ? `${elevation.toFixed(1)} m (FABDEM 30m DTM)` : 'Checking elevation…'}
          />
        </FieldGroup>

        <FieldGroup title="Timeline">
          <DetailItem label="Submitted" value={formatDateTime(report.createdAt)} />
          <DetailItem label="Observed" value={formatDateTime(report.observedAt)} />
          <DetailItem label="Last updated" value={formatDateTime(report.updatedAt)} />
        </FieldGroup>

        <StatusActionMenu report={report} isUpdating={isUpdating} onUpdateStatus={onUpdateStatus} />
      </div>
    </div>
  );

  if (modal) {
    return createPortal(
      <div className={`gakit-modal-overlay ${closing ? 'gakit-modal-closing' : ''}`}>
        <div
          className="fixed inset-0 z-[1300] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-6 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) requestClose();
          }}
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Report details"
            className="gakit-modal-open w-full max-w-xl overflow-hidden rounded-t-2xl bg-white shadow-2xl border border-slate-200/80 ring-1 ring-slate-900/5 outline-none sm:max-h-[85vh] sm:rounded-2xl"
          >
            <div className="h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" style={{ margin: '8px auto 4px' }} />
            {content}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return <aside className="overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-sm">{content}</aside>;
}

function LocationPreview({
  address,
  coordinates,
  copied,
  onCopy,
  onViewOnMap,
}: {
  address: string;
  coordinates: string;
  copied: boolean;
  onCopy: () => void;
  onViewOnMap?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-canvas-grey bg-canvas-light">
      <div className="relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.25) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative flex flex-col items-center text-gakit-maroon">
          <MapPin className="h-9 w-9 drop-shadow" fill="currentColor" fillOpacity={0.15} />
          <span className="mt-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gakit-maroon shadow-sm ring-1 ring-slate-200">
            {coordinates}
          </span>
        </div>
      </div>
      <div className="space-y-2 border-t border-canvas-grey p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-slate-700">{address}</span>
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copy coordinates"
            title="Copy coordinates"
            className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-canvas-light hover:text-slate-700"
          >
            {copied ? <Check className="h-4 w-4 text-hazard-safe" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        {onViewOnMap && (
          <button
            type="button"
            onClick={onViewOnMap}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-canvas-light hover:text-gakit-maroon"
          >
            <MapPin className="h-4 w-4" />
            View on map
          </button>
        )}
      </div>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{title}</h4>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">{children}</div>
    </div>
  );
}

function StatusActionMenu({
  report,
  isUpdating,
  onUpdateStatus,
}: {
  report: Report;
  isUpdating: boolean;
  onUpdateStatus: (report: Report, toStatus: ReportStatus, reason?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ bottom: 0, left: 0, width: 0 });
  const [pending, setPending] = useState<ReportStatus | null>(null);
  const [reason, setReason] = useState('');
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const options: Array<{ status: ReportStatus; label: string; className: string; icon: typeof CheckCircle2; needsReason: boolean }> = [
    { status: 'VERIFIED', label: 'Verify', className: 'text-hazard-safe', icon: CheckCircle2, needsReason: false },
    { status: 'ANOMALY', label: 'Mark Anomaly', className: 'text-hazard-critical', icon: AlertTriangle, needsReason: false },
    { status: 'REJECTED', label: 'Reject', className: 'text-slate-600', icon: XCircle, needsReason: true },
  ];

  const toggle = () => {
    if (open) return setOpen(false);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width });
    setOpen(true);
  };

  const selectOption = (option: (typeof options)[number]) => {
    if (!option.needsReason) {
      setOpen(false);
      onUpdateStatus(report, option.status);
      return;
    }
    setOpen(false);
    setPending(option.status);
    setReason('');
    window.setTimeout(() => reasonRef.current?.focus(), 0);
  };

  const confirmPending = () => {
    if (!pending) return;
    const option = options.find((o) => o.status === pending);
    if (option?.needsReason && !reason.trim()) return;
    onUpdateStatus(report, pending, reason.trim() ? reason.trim() : undefined);
  };

  const cancelPending = () => {
    setPending(null);
    setReason('');
  };

  return (
    <>
      <button ref={buttonRef} type="button" onClick={toggle} disabled={isUpdating} aria-haspopup="menu" aria-expanded={open} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-4 py-3 text-sm font-semibold text-white hover:bg-maroon-800 disabled:opacity-60">
        {isUpdating ? <Spinner size="sm" iconClassName="bg-white" /> : null}
        {!isUpdating && <span>Update Status</span>}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>

      {pending && (
        <div className="rounded-lg border border-canvas-grey bg-canvas-light p-4" role="group" aria-label="Reason for status change">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-800">
              {pending === 'REJECTED' ? 'Reason for rejection' : 'Add a note (optional)'}
            </span>
            {pending === 'REJECTED' && <span className="text-xs font-semibold text-hazard-critical">Required</span>}
          </div>
          <textarea
            ref={reasonRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={pending === 'REJECTED' ? 'Explain why this report is being rejected…' : 'Optional note for reviewers…'}
            aria-label="Reason"
            className="w-full resize-y rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-gakit-maroon"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelPending}
              disabled={isUpdating}
              className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-canvas-light disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmPending}
              disabled={isUpdating || (pending === 'REJECTED' && !reason.trim())}
              className="inline-flex items-center gap-2 rounded-lg bg-gakit-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUpdating ? <Spinner size="sm" iconClassName="bg-white" /> : null}
              Confirm
            </button>
          </div>
        </div>
      )}

      {open && createPortal(
        <>
          <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-[1300]" onClick={() => setOpen(false)} />
          <div role="menu" style={{ position: 'fixed', bottom: menuPos.bottom, left: menuPos.left, width: menuPos.width }} className="z-[1400] overflow-hidden rounded-lg border border-canvas-grey bg-white shadow-lg">
            {options.map((option, index) => {
              const isCurrent = report.status === option.status;
              const Icon = option.icon;
              return (
                <button
                  key={option.status}
                  role="menuitem"
                  disabled={isCurrent || isUpdating}
                  onClick={() => selectOption(option)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-canvas-light disabled:opacity-50 ${index > 0 ? 'border-t border-canvas-grey' : ''} ${option.className}`}
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
    </>
  );
}

function DetailItem({ label, value, loading = false }: { label: string; value: string; loading?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 font-medium text-slate-900">
        {loading && <Spinner size="xs" />}
        <span className="break-words">{value}</span>
      </div>
    </div>
  );
}
