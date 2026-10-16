'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
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
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  REFERENCE_LABELS,
  STATUS_META,
  formatDateTime,
  formatReportDepth,
  formatValidationFlag,
  getReportScoreDisplay,
} from '@/lib/reports/reportFormatting';
import type { Report, ReportStatus } from '@/types/report';
import { requestReportReassessment } from './actions/reports';
import { RejectionReasonSelect } from './RejectionReason';

const ReportMiniMap = dynamic(() =>
  import('./ReportMiniMap').then((mod) => ({ default: mod.ReportMiniMap })),
  { ssr: false }
);

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
  const [closing, setClosing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCoord, setCopiedCoord] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const panelRef = useModalA11y<HTMLDivElement>({ enabled: modal });

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
        // Escape closes the photo lightbox first, not the whole details card.
        if (photoOpen) {
          setPhotoOpen(false);
          return;
        }
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modal, requestClose, photoOpen]);

  // Focus, focus trap, scroll lock and focus restoration are handled by
  // `useModalA11y` (modal mode only); Escape stays below so it can dismiss the
  // inner photo lightbox before the drawer itself.

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
    <div className={modal ? 'flex max-h-[90dvh] flex-col' : 'flex flex-col'}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900">Report Details</h3>
          <div className="mt-1 flex items-center gap-1.5">
            <p className="truncate font-mono text-[10px] text-slate-500" title={report.id}>#{report.id.slice(0, 8)}</p>
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

      <div className={`min-h-0 space-y-4 p-4 sm:p-5 ${modal ? 'overflow-y-auto overscroll-contain' : ''}`}>
        <div className={`grid gap-4 ${modal ? 'sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : ''}`}>
          <div className="min-w-0 space-y-3">
            <LocationPreview
              address={address}
              coordinates={coordinates}
              latitude={report.location.latitude}
              longitude={report.location.longitude}
              status={report.status}
              copied={copiedCoord}
              onCopy={() => copyText(coordinates, 'coord')}
              onViewOnMap={onViewOnMap}
            />
            <PhotoEvidence photoUrl={report.photoUrl} reportId={report.id} onOpen={() => setPhotoOpen(true)} />
          </div>
          <div className="min-w-0 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reported water depth</p>
              <p className="mt-1 text-lg font-bold leading-6 text-slate-900">{formatReportDepth(report.depth, report.depthCm)}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span>Reporter: <strong className="font-semibold text-slate-700">{report.reporterType === 'staff' ? 'Staff' : report.reporterType === 'public' ? 'Public' : report.validationFlags?.includes('STAFF_REPORTER') ? 'Staff' : 'Unknown'}</strong></span>
                {report.reference && <span>Reference: {REFERENCE_LABELS[report.reference] || report.reference}</span>}
              </div>
            </div>
            <ValidationSection report={report} />
            <ReassessmentAction key={report.id} reportId={report.id} />
          </div>
        </div>
        <FieldGroup title="Timeline">
          <DetailItem label="Submitted" value={formatDateTime(report.createdAt)} />
          <DetailItem label="Observed" value={formatDateTime(report.observedAt)} />
          <DetailItem label="Last updated" value={formatDateTime(report.updatedAt)} />
        </FieldGroup>
      </div>
      <div className="shrink-0 space-y-2 border-t border-slate-100 bg-white px-4 py-3 sm:px-5">
        <StatusActionMenu report={report} isUpdating={isUpdating} onUpdateStatus={onUpdateStatus} />
      </div>
    </div>
  );

  const lightbox =
    photoOpen && report.photoUrl
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Report photo"
            className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
            onClick={() => setPhotoOpen(false)}
          >
            <button
              type="button"
              onClick={() => setPhotoOpen(false)}
              aria-label="Close photo"
              className="absolute right-4 top-4 rounded-lg border border-white/20 bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- Supabase host isn't in next.config images.remotePatterns */}
            <img
              src={report.photoUrl}
              alt={`Photo evidence for report ${report.id}`}
              className="max-h-[90vh] max-w-full rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )
      : null;

  if (modal) {
    return createPortal(
      <>
        {lightbox}
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
              className="gakit-modal-open w-full max-w-3xl overflow-hidden rounded-t-2xl bg-white shadow-2xl border border-slate-200/80 ring-1 ring-slate-900/5 outline-none sm:max-h-[90dvh] sm:rounded-2xl"
            >
              <div className="h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" style={{ margin: '8px auto 4px' }} />
              {content}
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  }

  return (
    <>
      {lightbox}
      <aside className="overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-sm">{content}</aside>
    </>
  );
}

function LocationPreview({
  address,
  coordinates,
  latitude,
  longitude,
  status,
  copied,
  onCopy,
  onViewOnMap,
}: {
  address: string;
  coordinates: string;
  latitude: number;
  longitude: number;
  status: ReportStatus;
  copied: boolean;
  onCopy: () => void;
  onViewOnMap?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-canvas-grey bg-canvas-light">
      <div className="relative h-32 sm:h-36">
        <ReportMiniMap latitude={latitude} longitude={longitude} status={status} onViewOnMap={onViewOnMap} />
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-slate-950/60 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">
          {coordinates}
        </span>
      </div>
      <div className="space-y-2 border-t border-canvas-grey p-2.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold leading-5 text-slate-700">{address}</span>
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
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-canvas-grey bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-canvas-light hover:text-gakit-maroon"
          >
            <MapPin className="h-4 w-4" />
            View on map
          </button>
        )}
      </div>
    </div>
  );
}

function PhotoEvidence({
  photoUrl,
  reportId,
  onOpen,
}: {
  photoUrl?: string | null;
  reportId: string;
  onOpen: () => void;
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Photo evidence</h4>
      {photoUrl ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label="View photo full size"
          className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-canvas-grey bg-canvas-light focus:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase host isn't in next.config images.remotePatterns */}
          <img
            src={photoUrl}
            alt={`Photo evidence for report ${reportId}`}
            loading="lazy"
            className="h-32 w-full object-cover sm:h-36"
          />
        </button>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">No photo submitted</p>
      )}
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">{children}</div>
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
  const pendingNeedsReason = pending === 'REJECTED' || pending === 'UNVERIFIED';
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const options: Array<{ status: ReportStatus; label: string; className: string; icon: typeof CheckCircle2; needsReason: boolean }> = [
    { status: 'UNVERIFIED', label: 'Reopen for review', className: 'text-slate-600', icon: AlertTriangle, needsReason: true },
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
      <button ref={buttonRef} type="button" onClick={toggle} disabled={isUpdating} aria-haspopup="menu" aria-expanded={open} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gakit-maroon px-3 py-2 text-xs font-semibold text-white hover:bg-maroon-800 disabled:opacity-60">
        {isUpdating ? <Spinner size="sm" iconClassName="bg-white" /> : null}
        {!isUpdating && <span>Update Status</span>}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>

      {pending && (
        <div className="rounded-lg border border-canvas-grey bg-canvas-light p-4" role="group" aria-label="Reason for status change">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-800">
              {pending === 'REJECTED' ? 'Reason for rejection' : 'Reason for reopening'}
            </span>
            {pendingNeedsReason && <span className="text-xs font-semibold text-hazard-critical">Required</span>}
          </div>
          {pending === 'REJECTED' ? <RejectionReasonSelect value={reason} onChange={setReason} disabled={isUpdating} /> : <textarea
            ref={reasonRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Explain why this report needs another review…"
            aria-label="Reason"
            className="w-full resize-y rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-gakit-maroon"
          />}
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
              disabled={isUpdating || (pendingNeedsReason && !reason.trim())}
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
            {options.filter(option => option.status !== 'UNVERIFIED' || report.status !== 'UNVERIFIED').map((option, index) => {
              const isCurrent = report.status === option.status && (report.decisionSource === 'manual' || option.status === 'UNVERIFIED');
              const Icon = option.icon;
              return (
                <button
                  key={option.status}
                  role="menuitem"
                  disabled={isCurrent || isUpdating}
                  onClick={() => selectOption(option)}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-canvas-light disabled:opacity-50 ${index > 0 ? 'border-t border-canvas-grey' : ''} ${option.className}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left">{option.label}</span>
                  {isCurrent && <span className="text-[10px] font-medium text-slate-400">Current</span>}
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
      <div className="text-[10px] font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-900">
        {loading && <Spinner size="xs" />}
        <span className="break-words">{value}</span>
      </div>
    </div>
  );
}

function ReassessmentAction({ reportId }: { reportId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'queued' | 'error'>('idle');
  const request = async () => {
    setState('loading');
    try {
      await requestReportReassessment(reportId);
      setState('queued');
    } catch {
      setState('error');
    }
  };
  return (
    <div className="text-xs">
      <button type="button" onClick={request} disabled={state === 'loading' || state === 'queued'}
        className="rounded-md border border-canvas-grey px-2.5 py-1.5 font-semibold text-slate-700 disabled:opacity-60">
        {state === 'loading' ? 'Queuing assessment…' : state === 'queued' ? 'Assessment queued' : 'Request reassessment'}
      </button>
      <p role="status" className="mt-1 text-[10px] leading-4 text-slate-500">
        {state === 'queued' ? 'The updated assessment will be available after processing.' : state === 'error' ? 'Could not queue an assessment. Please try again.' : ''}
      </p>
    </div>
  );
}

function ValidationSection({ report }: { report: Report }) {
  const scoreDisplay = getReportScoreDisplay(report);
  if (report.validationSummary) {
    const summary = report.validationSummary;
    return (
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Evidence assessment</h4>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700" title={scoreDisplay.title}>{scoreDisplay.score == null ? "Awaiting assessment" : `${scoreDisplay.score} points`}</span>
        </div>
        <p className="text-xs leading-5 text-slate-700">{summary.explanation}</p>
        <p className="text-[10px] leading-4 text-slate-500">
          {report.decisionSource === 'manual' ? 'Status set by a moderator.' : report.decisionSource === 'automated' ? 'Status set by automated assessment.' : 'Awaiting reassessment of the saved status.'}
          {' '}Assessed {formatDateTime(summary.assessedAt)}.
        </p>
        {report.decisionSource === 'manual' && summary.recommendedStatus !== report.status && (
          <p className="text-xs text-slate-600">Assessment recommendation: {STATUS_META[summary.recommendedStatus].label}. The moderator’s decision remains in effect.</p>
        )}
        {([
          ['Supporting evidence', summary.support],
          ['Evidence conflicts', summary.conflicts],
          ['Missing or stale evidence', summary.missing],
        ] as const).filter(([, flags]) => flags.length > 0).map(([label, flags]) => (
          <div key={label}>
            <h5 className="text-[10px] font-semibold text-slate-500">{label}</h5>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-700">
              {flags.length ? flags.map(flag => formatValidationFlag(flag).label).join(' · ') : 'None recorded'}
            </p>
          </div>
        ))}
        <p className="border-t border-slate-100 pt-2 text-[10px] leading-4 text-slate-400">Evidence points support verification; they do not measure urgency.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <h4 className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Evidence assessment</h4>
      <p className="text-xs leading-5 text-slate-600">Awaiting evidence assessment. Request reassessment to check this report.</p>
    </div>
  );
}
