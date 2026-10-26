'use client';

import { AlertCircle, CheckCircle2, ChevronDown, ClipboardCheck, MapPin, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchReportReceipt } from '@/app/public-view/actions/publicView';
import { getReportFeedbackPresentation } from '@/lib/reports/feedbackPresentation';
import { formatReportDepth } from '@/lib/reports/reportFormatting';
import type { DepthCategory, ReportReceipt, ReportStatus } from '@/types/report';
import { Dialog } from '@/components/ui/Dialog';

export interface SubmittedReport extends ReportReceipt {
  id: string;
  location: { lat: number; lng: number; address: string };
  depth: DepthCategory;
  depthCm?: number | null;
  reference?: { label: string; landmark: string };
  status: ReportStatus;
  submittedAt: string;
  photoUploadToken?: string;
}

const TONE = {
  green: 'border-green-200 bg-green-50/70 text-green-950',
  amber: 'border-amber-200 bg-amber-50/70 text-amber-950',
  slate: 'border-slate-200 bg-slate-50 text-slate-800',
};

export function SuccessModal({ isOpen, report, onClose }: {
  isOpen: boolean;
  report: SubmittedReport | null;
  onClose: () => void;
}) {
  const [refreshState, setRefreshState] = useState<{ id: string; receipt?: ReportReceipt; failed: boolean } | null>(null);
  const latest = refreshState?.id === report?.id ? refreshState?.receipt : undefined;
  const refreshFailed = refreshState?.id === report?.id && refreshState?.failed;
  useEffect(() => {
    if (!isOpen || !report) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const receipt = await fetchReportReceipt(report.id, controller.signal, report.photoUploadToken);
        if (!controller.signal.aborted) {
          setRefreshState({ id: report.id, receipt, failed: false });
        }
      } catch {
        if (!controller.signal.aborted) setRefreshState(previous => ({
          id: report.id, receipt: previous?.id === report.id ? previous.receipt : undefined, failed: true,
        }));
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 5000);
      }
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [isOpen, report]);
  if (!isOpen || !report) return null;
  const current = latest ?? report;
  const view = getReportFeedbackPresentation(current);
  const StatusIcon = view.tone === 'green' ? CheckCircle2 : current.status === 'REJECTED' ? XCircle : AlertCircle;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} ariaLabelledBy="submission-receipt-title"
      maxWidthClass="max-w-lg" panelClassName="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
      <header className="flex shrink-0 items-start gap-3 border-b border-slate-100 p-5 sm:px-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-maroon-50 text-gakit-maroon">
          <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="submission-receipt-title" className="text-lg font-bold text-slate-900">Report submitted</h2>
          <p className="mt-1 text-[13px] leading-5 text-slate-500">Your submission is saved. Its review status is below.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close report feedback"
          className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-5 sm:px-6">
        <section aria-label="Saved review status" className={`rounded-xl border p-4 ${TONE[view.tone]}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Saved review status</span>
            <span className="rounded-full border border-current/15 bg-white/70 px-2.5 py-1 text-[11px] font-semibold">{view.label}</span>
          </div>
          <div className="mt-3 flex items-start gap-2.5">
            <StatusIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold">{view.title}</h3>
              <p className="mt-1 text-[13px] leading-6">{view.description}</p>
              <p className="mt-2 text-xs leading-5 opacity-80">{view.nextStep}</p>
            </div>
          </div>
          <p className="mt-3 border-t border-current/10 pt-2.5 text-[11px] opacity-70">{view.origin}</p>
          {latest && latest.status !== report.status && <p className="mt-1 text-xs font-medium">Status updated after submission.</p>}
        </section>

        {view.reviewNotice && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">{view.reviewNotice}</p>}
        {refreshFailed && <p role="status" className="text-xs leading-5 text-slate-500">Could not refresh. Showing the last saved status.</p>}

        <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
          <div className="col-span-2">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />Reported location</dt>
            <dd className="mt-1.5 break-words text-sm font-medium leading-6 text-slate-800">{report.location.address}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-slate-500">Reported water depth</dt>
            <dd className="mt-1.5 text-[13px] font-semibold leading-5 text-slate-800">{formatReportDepth(report.depth, report.depthCm)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-slate-500">Submitted</dt>
            <dd className="mt-1.5 text-xs leading-5 text-slate-700">{report.submittedAt}</dd>
          </div>
        </dl>

        <details className="group border-t border-slate-100 pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded py-1 text-xs font-medium text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon [&::-webkit-details-marker]:hidden">
            Submission details <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </summary>
          <dl className="mt-3 space-y-3 text-xs leading-5">
            <div><dt className="text-slate-500">Report ID</dt><dd className="mt-1 select-all break-all font-mono text-[11px] text-slate-700">{report.id}</dd></div>
            {view.assessedAt && <div><dt className="text-slate-500">Evidence checked</dt><dd className="mt-1 text-slate-700">{new Date(view.assessedAt).toLocaleString()}</dd></div>}
            {view.decidedAt && <div><dt className="text-slate-500">Staff decision recorded</dt><dd className="mt-1 text-slate-700">{new Date(view.decidedAt).toLocaleString()}</dd></div>}
            {view.savedExplanation && <div><dt className="text-slate-500">Saved assessment explanation</dt><dd className="mt-1 text-slate-700">{view.savedExplanation}</dd></div>}
          </dl>
        </details>
      </div>
      <footer className="shrink-0 border-t border-slate-100 px-5 py-4 sm:px-6">
        <button type="button" onClick={onClose}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gakit-maroon px-4 text-sm font-semibold text-white transition-colors hover:bg-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2">
          Done
        </button>
      </footer>
    </Dialog>
  );
}
