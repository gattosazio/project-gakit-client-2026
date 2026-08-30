'use client';

import { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { REPORT_STATUS_LABELS } from '@/constants/publicMap';
import type { DepthCategory, ReportStatus } from '@/types/report';

export interface SubmittedReport {
  id: string;
  location: { lat: number; lng: number; address: string };
  depth: DepthCategory;
  reference?: { label: string; landmark: string };
  status: ReportStatus;
  submittedAt: string;
}

const formatApproximateDepth = (depth: DepthCategory) =>
  depth.code === 'overhead' ? `~${depth.approximateCm} cm or deeper` : `~${depth.approximateCm} cm`;

export function SuccessModal({
  isOpen,
  report,
  onClose,
  onViewMap,
  onSubmitAnother,
}: {
  isOpen: boolean;
  report: SubmittedReport | null;
  onClose: () => void;
  onViewMap: () => void;
  onSubmitAnother: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center border border-slate-200/90 ring-1 ring-slate-900/5 animate-[scaleIn_150ms_ease-out]">
        <button
          onClick={onClose}
          aria-label="Close success dialog"
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors active:scale-95"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mt-4">Report submitted</h2>
        <p className="text-sm text-slate-600 mt-2">
          Thank you. Your report has been added as unverified and will be reviewed with other flood data.
        </p>

        {report && (
          <div className="mt-5 text-left rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 space-y-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">Reference ID</div>
              <div className="text-sm font-semibold text-slate-900 font-mono">{report.id}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Location</div>
              <div className="text-sm text-slate-900">{report.location.address}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500">Flood depth</div>
                <div className="text-sm text-slate-900">
                  {report.depth.label} ({formatApproximateDepth(report.depth)})
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">Status</div>
                <div className="text-sm font-semibold text-amber-600">
                  {REPORT_STATUS_LABELS[report.status]}
                </div>
              </div>
            </div>
            {report.reference && (
              <div>
                <div className="text-xs font-semibold text-slate-500">Reference</div>
                <div className="text-sm text-slate-900">
                  {report.reference.label} · {report.reference.landmark}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-slate-500">Submitted</div>
              <div className="text-sm text-slate-900">{report.submittedAt}</div>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={onViewMap}
            className="py-2.5 px-4 rounded-xl font-semibold bg-gakit-maroon hover:bg-maroon-800 active:scale-[0.98] text-white transition-all shadow-xs"
          >
            View on Map
          </button>
          <button
            onClick={onSubmitAnother}
            className="py-2.5 px-4 rounded-xl font-semibold border border-slate-200/90 text-slate-700 bg-white hover:bg-slate-50 active:scale-[0.98] transition-all shadow-xs"
          >
            Submit Another
          </button>
        </div>
      </div>
    </div>
  );
}
