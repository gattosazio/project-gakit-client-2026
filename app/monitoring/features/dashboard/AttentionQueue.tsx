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
  critical: 'Critical · needs verification now',
  flagged: 'Flagged · decide keep or reject',
  pending: 'Pending · added to the queue',
};

const GROUP_ROW_BAR: Record<QueueGroup, string> = {
  critical: 'border-l-red-500',
  flagged: 'border-l-orange-400',
  pending: 'border-l-amber-400',
};

const GROUP_ICON: Record<QueueGroup, string> = {
  critical: 'text-red-600',
  flagged: 'text-orange-500',
  pending: 'text-amber-500',
};

const QUEUE_LIMIT = 8;

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
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-2 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <h2 className="font-bold text-slate-900">Needs your attention</h2>
          <p className="mt-1 text-sm text-slate-500">
            Reports in the last 24 hours that still need a decision.
          </p>
        </div>
        {total > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {counts.critical > 0 && (
              <CountChip label={`${counts.critical} critical`} className="bg-red-50 text-red-700 border-red-200" />
            )}
            {counts.flagged > 0 && (
              <CountChip label={`${counts.flagged} flagged`} className="bg-orange-50 text-orange-700 border-orange-200" />
            )}
            {counts.pending > 0 && (
              <CountChip label={`${counts.pending} pending`} className="bg-amber-50 text-amber-700 border-amber-200" />
            )}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between px-5 py-4 md:px-6">
              <div className="space-y-2">
                <div className="h-3.5 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-8 w-16 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-hazard-safe" />
          <p className="text-sm font-semibold text-slate-900">Nothing needs review right now</p>
          <p className="text-sm text-slate-500">New and fragile reports will land here as they come in.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visible.map(({ report, group, ageLabel }) => {
            const meta = STATUS_META[report.status];
            return (
              <div key={report.id} className={`flex items-start gap-3 border-l-[3px] bg-white px-5 py-4 md:px-6 ${GROUP_ROW_BAR[group]}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={`font-semibold ${GROUP_ICON[group]}`}>
                      {report.location.address || 'Unknown location'}
                    </span>
                    <span className="text-xs text-slate-500">{ageLabel}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span className="font-semibold">
                      {formatReportDepth(report.depth, report.depthCm)}
                    </span>
                    <span className="hidden text-slate-300 sm:inline">·</span>
                    <span className="text-xs text-slate-500">{GROUP_ORDER_HINT[group]}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`hidden rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex ${meta.badgeClass}`}>
                    {meta.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => onReview(report.id, report.status)}
                    className="rounded-lg bg-gakit-maroon px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-maroon-800"
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
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
          {remaining > 0 ? (
            <p className="text-sm text-slate-500">
              {remaining} more need review — see them all in Report Management.
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              {total} report{total === 1 ? '' : 's'} waiting on decisions.
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onViewAll('UNVERIFIED')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-gakit-maroon hover:text-gakit-maroon"
            >
              <ShieldAlert className="h-4 w-4" />
              View pending
            </button>
            <button
              type="button"
              onClick={() => onViewAll('ANOMALY')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-gakit-maroon hover:text-gakit-maroon"
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