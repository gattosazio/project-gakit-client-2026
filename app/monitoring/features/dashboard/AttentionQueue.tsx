'use client';

import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { formatReportDepth, STATUS_META } from '@/lib/reports/reportFormatting';
import type { ReportStatus } from '@/types/report';
import type { QueueCounts, QueueGroup, QueueItem } from './aggregate';

interface AttentionQueueProps {
  items: QueueItem[];
  counts: QueueCounts;
  loading?: boolean;
  onReview: (reportId: string, status: ReportStatus) => void;
  onViewAll: (status: ReportStatus) => void;
}

const GROUP_ORDER_HINT: Record<QueueGroup, string> = {
  critical: 'High Severity · Immediate Action',
  flagged: 'Flagged Anomaly · Needs Verification',
  pending: 'Unverified · Awaiting Review',
};

const GROUP_ROW_BAR: Record<QueueGroup, string> = {
  critical: 'border-l-violet-500',
  flagged: 'border-l-blue-400',
  pending: 'border-l-slate-300',
};

const GROUP_ICON: Record<QueueGroup, string> = {
  critical: 'text-violet-600',
  flagged: 'text-blue-500',
  pending: 'text-slate-500',
};

const QUEUE_LIMIT = 5;

export function AttentionQueue({
  items,
  counts,
  loading = false,
  onReview,
  onViewAll,
}: AttentionQueueProps) {
  const visible = items.slice(0, QUEUE_LIMIT);
  const remaining = items.length - visible.length;
  const total = items.length;

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-3.5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">Priority Triage Queue</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Citizen flood reports requiring verification or triage.
          </p>
        </div>
        {total > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {counts.critical > 0 && (
              <CountChip label={`${counts.critical} critical`} className="bg-violet-50 text-violet-700 border-violet-200" />
            )}
            {counts.flagged > 0 && (
              <CountChip label={`${counts.flagged} flagged`} className="bg-blue-50 text-blue-700 border-blue-200" />
            )}
            {counts.pending > 0 && (
              <CountChip label={`${counts.pending} pending`} className="bg-slate-100 text-slate-600 border-slate-200" />
            )}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3">
              <div className="space-y-1.5">
                <div className="h-3.5 w-36 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-7 w-14 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <CheckCircle2 className="h-8 w-8 text-hazard-safe" />
          <p className="text-sm font-semibold text-slate-900">Queue Clear · All Reports Processed</p>
          <p className="text-xs text-slate-500">New citizen flood reports will appear here as they are received.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visible.map(({ report, group, ageLabel }) => {
            const meta = STATUS_META[report.status];
            return (
              <div key={report.id} className={`flex items-start gap-3 border-l-[3px] bg-white px-4 py-2.5 sm:px-5 sm:py-3 ${GROUP_ROW_BAR[group]}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                    <span className={`text-xs font-semibold sm:text-sm ${GROUP_ICON[group]}`}>
                      {report.location.address || 'Unknown location'}
                    </span>
                    <span className="text-[11px] text-slate-400 sm:text-xs sm:text-slate-500">{ageLabel}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-semibold">
                      {formatReportDepth(report.depth, report.depthCm)}
                    </span>
                    <span className="hidden text-slate-300 sm:inline">·</span>
                    <span className="text-[11px] text-slate-400 sm:text-xs sm:text-slate-500">{GROUP_ORDER_HINT[group]}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`hidden rounded-full border px-2 py-0.5 text-[11px] font-semibold sm:inline-flex ${meta.badgeClass}`}>
                    {meta.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onReview(report.id, report.status)}
                    className="rounded-lg bg-gakit-maroon px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-maroon-800"
                  >
                    Review
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3">
          {remaining > 0 ? (
            <p className="text-xs text-slate-500">
              {remaining} additional report{remaining === 1 ? '' : 's'} awaiting review in Report Management.
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              {total} report{total === 1 ? '' : 's'} awaiting operational triage.
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onViewAll('UNVERIFIED')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-gakit-maroon hover:text-gakit-maroon"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              View pending
            </button>
            <button
              type="button"
              onClick={() => onViewAll('ANOMALY')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-gakit-maroon hover:text-gakit-maroon"
            >
              View flagged
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CountChip({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}