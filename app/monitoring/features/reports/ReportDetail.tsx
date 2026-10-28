'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  Copy,
  MapPin,
  X,
} from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  REFERENCE_LABELS,
  STATUS_META,
  DEPTH_LABELS,
  formatDateTime,
} from '@/lib/reports/reportFormatting';
import type { Report, ReportStatus } from '@/types/report';
import { ReportDecisionDialog } from './ReportDecisionDialog';
import type { DecisionReason } from '@/lib/reports/decisionReasons';
import { ReportAssessment, ReportValidationChecks } from './ReportAssessment';
import { StaffDecisionHistory } from './StaffDecisionHistory';

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
  onUpdateStatus: (report: Report, toStatus: ReportStatus, reason?: DecisionReason) => Promise<boolean>;
  onViewOnMap?: () => void;
  modal?: boolean;
}) {
  const status = STATUS_META[report.status];
  const address = report.location.address || `${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`;
  const [closing, setClosing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCoord, setCopiedCoord] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const photoTrigger = useRef<HTMLElement | null>(null);
  const panelRef = useModalA11y<HTMLDivElement>({ enabled: modal && !decisionOpen && !photoOpen });

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }, [closing, onClose]);

  useEffect(() => {
    if (!modal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (decisionOpen || photoOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modal, requestClose, photoOpen, decisionOpen]);


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
  const photoUrl = report.photoUrl?.trim() || null;

  const content = (
    <div className={modal ? 'flex max-h-[calc(100dvh-2rem)] flex-col sm:max-h-[calc(100dvh-3rem)]' : 'flex flex-col'}>
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Report details</p>
          <h3 title={address} className="mt-0.5 line-clamp-2 break-words text-sm font-bold leading-5 text-slate-900 sm:text-base">{address}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badgeClass}`}>{status.label}</span>
          <button type="button" onClick={requestClose} aria-label="Close report details"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
        </div>
      </header>
      <div className={`min-h-0 space-y-3 p-3 sm:p-4 ${modal ? 'overflow-y-auto overscroll-contain' : ''}`}>
        <div className={`grid items-start gap-3 ${modal ? 'sm:grid-cols-2' : ''}`}>
          <ObservationSnapshot report={report} />
          <ReportAssessment report={report} />
        </div>
        <section aria-label="Report evidence">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Evidence</h4>
            {!photoUrl && <span className="text-[10px] text-slate-400">No photo attached</span>}
          </div>
          <div className={`grid gap-3 ${modal && photoUrl ? 'sm:grid-cols-2' : ''}`}>
            {photoUrl && <PhotoEvidence photoUrl={photoUrl} reportId={report.id} onOpen={() => {
              photoTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              setPhotoOpen(true);
            }} />}
            <LocationPreview coordinates={coordinates} latitude={report.location.latitude} longitude={report.location.longitude}
              status={report.status} copied={copiedCoord} onCopy={() => copyText(coordinates, 'coord')} onViewOnMap={onViewOnMap} />
          </div>
        </section>
        <ReportValidationChecks report={report} />
        {report.decisionSource === 'manual' && <StaffDecisionHistory key={`${report.id}:${report.updatedAt}`} reportId={report.id} />}
        <details className="group rounded-xl border border-slate-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-3 text-xs font-semibold text-slate-700 focus-visible:outline-gakit-maroon [&::-webkit-details-marker]:hidden">
            Report history<ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 p-3 text-xs">
            <DetailItem label="Submitted" value={formatDateTime(report.createdAt)} />
            <DetailItem label="Last updated" value={formatDateTime(report.updatedAt)} />
            <div className="col-span-2 min-w-0">
              <dt className="text-[10px] text-slate-500">Report ID</dt>
              <dd className="mt-1 flex items-start gap-2">
                <span className="min-w-0 break-all font-mono text-[11px] text-slate-700">{report.id}</span>
                <button type="button" onClick={() => copyText(report.id, 'id')} aria-label="Copy report ID" className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-50">
                  {copiedId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </dd>
            </div>
          </dl>
        </details>
      </div>
      <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-2">
        <StatusActionMenu report={report} isUpdating={isUpdating} onUpdateStatus={onUpdateStatus} onOpenChange={setDecisionOpen} />
      </div>
    </div>
  );

  const lightbox = photoOpen && photoUrl ? <PhotoLightbox photoUrl={photoUrl} reportId={report.id} onClose={() => {
    setPhotoOpen(false);
    requestAnimationFrame(() => photoTrigger.current?.focus());
  }} /> : null;

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
              aria-modal={!decisionOpen && !photoOpen}
              inert={decisionOpen || photoOpen}
              aria-label="Report details"
              className="gakit-modal-open w-full max-w-3xl overflow-hidden rounded-t-2xl bg-white shadow-2xl border border-slate-200/80 ring-1 ring-slate-900/5 outline-none sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl"
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

function ObservationSnapshot({ report }: { report: Report }) {
  const metadata = report.observation ?? report.validationSummary?.observation;
  const method = metadata?.depthMethod ?? report.validationSummary?.depthQuality ?? 'unknown';
  const numericDepth = method !== 'category' && report.depthCm != null && Number.isFinite(report.depthCm) ? report.depthCm : null;
  const methodLabel = method === 'category' ? 'Category only' : method === 'measured' ? 'Measured by reporter'
    : method === 'estimated' ? 'Estimated' : 'Method not recorded';
  const reporter = report.reporterType === 'staff' || (!report.reporterType && report.validationFlags?.includes('STAFF_REPORTER'))
    ? 'Staff' : report.reporterType === 'public' ? 'Public reporter' : 'Not recorded';
  return <section aria-label="Reported observation" className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
      <div className="col-span-2">
        <h4 className="text-[10px] font-medium text-slate-500">Reported water depth</h4>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-base font-bold leading-5 text-slate-900">
          <span>{DEPTH_LABELS[report.depth.code]}</span>
          {numericDepth != null && <span className="text-xs font-semibold text-slate-700">{method === 'estimated' ? 'About ' : ''}{numericDepth} cm</span>}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">{methodLabel}</p>
        {numericDepth == null && (method === 'estimated' || method === 'measured') && <p className="mt-1 text-[10px] text-slate-500">No numeric depth recorded</p>}
      </div>
      <div className="min-w-0 text-xs">
        <p className="text-[10px] text-slate-500">Observed</p>
        <time dateTime={report.observedAt} className="mt-1 block font-medium leading-5 text-slate-700">{formatDateTime(report.observedAt)}</time>
        {metadata?.timeSource === 'submission_default' && <p className="mt-1 text-[10px] leading-4 text-slate-500">Uses submission time</p>}
      </div>
      <div className="min-w-0 text-xs">
        <p className="text-[10px] text-slate-500">Reporter</p>
        <p className="mt-1 font-medium leading-5 text-slate-700">{reporter}</p>
        {report.reference && <p className="mt-1 text-[10px] leading-4 text-slate-500">Depth reference: {REFERENCE_LABELS[report.reference]}</p>}
      </div>
    </div>
  </section>;
}

function LocationPreview({ coordinates, latitude, longitude, status, copied, onCopy, onViewOnMap }: {
  coordinates: string; latitude: number; longitude: number; status: ReportStatus; copied: boolean;
  onCopy: () => void; onViewOnMap?: () => void;
}) {
  return <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <h5 className="px-3 py-2 text-[11px] font-medium text-slate-500">Reported location</h5>
    <div className="relative h-40 overflow-hidden bg-slate-50"><ReportMiniMap latitude={latitude} longitude={longitude} status={status} onViewOnMap={onViewOnMap} /></div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
      <span className="text-[10px] text-slate-500">{coordinates}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCopy} aria-label="Copy coordinates" className="rounded p-1 text-slate-400 hover:bg-slate-50">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>
        {onViewOnMap && <button type="button" onClick={onViewOnMap} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gakit-maroon"><MapPin className="h-3.5 w-3.5" />View on map</button>}
      </div>
    </div>
  </div>;
}

function PhotoEvidence({ photoUrl, reportId, onOpen }: { photoUrl: string; reportId: string; onOpen: () => void }) {
  return <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <h5 className="px-3 py-2 text-[11px] font-medium text-slate-500">Reporter photo</h5>
    <button type="button" onClick={onOpen} aria-label="View photo full size" className="block w-full cursor-zoom-in text-left focus-visible:outline-gakit-maroon">
      {/* eslint-disable-next-line @next/next/no-img-element -- Evidence host is supplied by the existing storage API. */}
      <img src={photoUrl} alt={`Photo evidence for report ${reportId}`} loading="lazy" className="h-40 w-full object-cover" />
      <span className="block border-t border-slate-100 px-3 py-2.5 text-[11px] font-medium text-gakit-maroon">View full photo</span>
    </button>
  </div>;
}

function PhotoLightbox({ photoUrl, reportId, onClose }: { photoUrl: string; reportId: string; onClose: () => void }) {
  const ref = useModalA11y<HTMLDivElement>({ restoreFocus: false });
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return createPortal(<div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Report photo"
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-xs">
    <button type="button" onClick={onClose} aria-label="Close photo" className="absolute right-4 top-4 rounded-lg bg-white/10 p-3 text-white"><X className="h-5 w-5" /></button>
    {/* eslint-disable-next-line @next/next/no-img-element -- Same reporter-provided evidence as the preview. */}
    <img src={photoUrl} alt={`Photo evidence for report ${reportId}`} className="max-h-[85dvh] max-w-full rounded-xl object-contain" />
  </div>, document.body);
}

function StatusActionMenu({ report, isUpdating, onUpdateStatus, onOpenChange }: {
  report: Report;
  isUpdating: boolean;
  onUpdateStatus: (report: Report, toStatus: ReportStatus, reason?: DecisionReason) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => { setOpen(true); onOpenChange(true); }} disabled={isUpdating} aria-haspopup="dialog"
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gakit-maroon px-3 py-3 text-sm font-semibold text-white disabled:opacity-60">
      {isUpdating && <Spinner size="sm" />}Update report status<ChevronDown className="h-4 w-4" />
    </button>
    {open && <ReportDecisionDialog report={report} isUpdating={isUpdating} onClose={() => { setOpen(false); onOpenChange(false); }}
      onConfirm={(status, reason) => onUpdateStatus(report, status, reason)} />}
  </>;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[11px] font-medium text-slate-900">
        <span className="break-words">{value}</span>
      </dd>
    </div>
  );
}
