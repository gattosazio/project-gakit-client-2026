'use client';

import { CheckCircle2, ClipboardCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchReportReceipt } from '@/app/public-view/actions/publicView';
import { REPORT_STATUS_LABELS } from '@/constants/publicMap';
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

const ASSESSMENT: Record<ReportStatus, { message: string; className: string }> = {
  UNVERIFIED: { message: 'Your report is awaiting validation against available evidence.', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  VERIFIED: { message: 'Your report was accepted against the available flood evidence. Reported depth has not been independently checked.', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  ANOMALY: { message: 'Your report needs further review before it can be verified.', className: 'border-orange-200 bg-orange-50 text-orange-800' },
  REJECTED: { message: 'Your report was not accepted by validation and will not appear on the public map.', className: 'border-slate-200 bg-slate-50 text-slate-700' },
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
  if (!isOpen) return null;
  const current = latest ?? report;
  const demoAutoValidated = current?.validationSummary?.demoAutoValidated;
  const assessment = demoAutoValidated ? {
    message: 'Automatically approved for the demonstration. Global demo mode is enabled; evidence checks were skipped.',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  } : current ? ASSESSMENT[current.status] : null;
  const explanation = current?.decisionSource === 'manual'
    ? 'A moderator updated this report.'
    : current?.validationSummary?.explanation || assessment?.message;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} ariaLabelledBy="submission-receipt-title"
      maxWidthClass="max-w-md" panelClassName="relative max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6">
      <button type="button" onClick={onClose} aria-label="Close submission confirmation"
        className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 pr-7">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <h2 id="submission-receipt-title" className="text-lg font-bold text-slate-900">Report submitted</h2>
          <p className="mt-0.5 text-xs text-slate-500">Thank you for sharing conditions in your area.</p>
        </div>
      </div>

      {report && current && assessment && <>
        <div className={`mt-5 rounded-xl border p-3 ${assessment.className}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium"><ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />{latest ? 'Current assessment' : 'Status at submission'}</span>
            <strong className="text-xs">{REPORT_STATUS_LABELS[current.status]}</strong>
          </div>
          <p className="mt-1.5 text-xs leading-5">{explanation}</p>
          {current?.validationSummary?.assessedAt && <p className="mt-1 text-[10px] opacity-75">Assessed {new Date(current.validationSummary.assessedAt).toLocaleString()}</p>}
          {latest && latest.status !== report.status && <p className="mt-1 text-[10px] font-medium">Updated after submission.</p>}
          {refreshFailed && <p className="mt-1 text-[10px]">Unable to refresh. Showing the last saved assessment.</p>}
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-[11px] font-medium text-slate-500">Location</dt>
            <dd className="mt-0.5 break-words font-medium text-slate-800">{report.location.address}</dd>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[11px] font-medium text-slate-500">Flood depth</dt>
              <dd className="mt-0.5 text-xs font-medium text-slate-800">{formatReportDepth(report.depth, report.depthCm)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-slate-500">Submitted</dt>
              <dd className="mt-0.5 text-xs text-slate-700">{report.submittedAt}</dd>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <dt className="text-[11px] font-medium text-slate-500">Reference ID</dt>
            <dd className="mt-1 select-all break-all font-mono text-[11px] text-slate-600">{report.id}</dd>
          </div>
        </dl>
      </>}
      <p className="mt-4 text-xs leading-5 text-slate-500">{demoAutoValidated ? 'This demo approval does not establish flood or depth accuracy.' : 'Assessments can change when new evidence or a moderator decision arrives.'}</p>
      <button type="button" onClick={onClose}
        className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-gakit-maroon px-4 text-sm font-semibold text-white transition-colors hover:bg-maroon-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon focus-visible:ring-offset-2">
        Done
      </button>
    </Dialog>
  );
}
