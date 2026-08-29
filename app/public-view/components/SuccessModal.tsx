'use client';

import { CheckCircle2 } from 'lucide-react';
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1400] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mt-4">Report submitted</h2>
        <p className="text-sm text-slate-600 mt-2">
          Thank you. Your report has been added as unverified and will be reviewed with other flood data.
        </p>

        {report && (
          <div className="mt-5 text-left rounded-lg border border-canvas-grey bg-canvas-light p-4 space-y-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">Reference ID</div>
              <div className="text-sm font-semibold text-slate-900">{report.id}</div>
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
                <div className="text-sm font-semibold text-hazard-pending">
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
            className="py-3 px-4 rounded-lg font-semibold bg-gakit-maroon hover:bg-maroon-800 text-white transition-colors"
          >
            View on Map
          </button>
          <button
            onClick={onSubmitAnother}
            className="py-3 px-4 rounded-lg font-semibold border border-canvas-grey text-slate-700 hover:bg-canvas-light transition-colors"
          >
            Submit Another
          </button>
        </div>
      </div>
    </div>
  );
}
