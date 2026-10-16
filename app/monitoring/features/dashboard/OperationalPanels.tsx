'use client';

import { useState, type ReactNode } from 'react';
import { ArrowUpRight, Check, Clock3, MapPin, ShieldAlert, ShieldCheck, Waves } from 'lucide-react';
import type { DashboardSnapshot } from '@/types/dashboard';
import type { Report } from '@/types/report';
import { formatReportDepth, STATUS_META, timeAgo } from '@/lib/reports/reportFormatting';
import { INFLOW_STATUSES, inflowInterval, inflowSummary, manilaTime } from './operational';

export const PANEL_CLASS =
  'min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_3px_16px_rgba(15,23,42,0.03)]';

function PanelHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {action}
    </div>
  );
}

const REASONS = {
  high_severity: 'High reported depth',
  older_review: 'Older observation · review backlog',
  conflicting_evidence: 'Conflicting evidence',
  needs_review: 'Awaiting evidence or review',
};

export function PriorityReports({ snapshot, onOpen, onBrowse }: {
  snapshot: DashboardSnapshot;
  onOpen: (report: Report) => void;
  onBrowse: (status: 'UNVERIFIED' | 'ANOMALY') => void;
}) {
  const visible = snapshot.priorityReports.slice(0, 3);
  return (
    <section className={`${PANEL_CLASS} flex h-full flex-col`} aria-label="Priority reports">
      <PanelHeading title="Priority queue" action={
        <span className="text-[10px] text-slate-500">Recent severe observations & reviews</span>
      } />
      <div className="flex-1 divide-y divide-slate-100">
        {visible.length ? visible.map((report) => {
          const meta = STATUS_META[report.status];
          return (
            <button key={report.id} type="button" onClick={() => onOpen(report)}
              className="group flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${report.priorityReason === 'high_severity' ? 'bg-red-500' : report.priorityReason === 'older_review' ? 'bg-slate-400' : 'bg-violet-500'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-slate-800">{report.location.address || 'Unnamed report location'}</span>
                <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                  <span className="font-semibold text-slate-700">{formatReportDepth(report.depth, report.depthCm)}</span>
                  <span className="sm:hidden">{meta.label}</span>
                  <span>{REASONS[report.priorityReason]}</span>
                  <span title={manilaTime(report.observedAt, true)}>Observed {timeAgo(report.observedAt, Date.parse(snapshot.asOf))}</span>
                </span>
              </span>
              <span className={`hidden shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold sm:inline ${meta.badgeClass}`}>{meta.label}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-gakit-maroon" />
            </button>
          );
        }) : (
          <div className="flex items-center gap-3 px-4 py-10 text-xs text-slate-500">
            <Check className="h-5 w-5 text-slate-400" /> No recent severe observations or unresolved reviews.
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-2">
        <span className="text-[10px] text-slate-500">{snapshot.totals.olderReviews} older reviews · all dates included</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => onBrowse('UNVERIFIED')} className="text-[11px] font-semibold text-gakit-maroon">View pending ({snapshot.totals.pending})</button>
          <button type="button" onClick={() => onBrowse('ANOMALY')} className="text-[11px] font-semibold text-slate-600">Flagged ({snapshot.totals.flagged})</button>
        </div>
      </div>
    </section>
  );
}

export function WorkloadSummary({ snapshot, onReview }: { snapshot: DashboardSnapshot; onReview: () => void }) {
  const { totals } = snapshot;
  const metrics = [
    { label: 'High severity', detail: 'Observed in 24h', value: totals.highSeverity, icon: Waves, color: 'text-red-600' },
    { label: 'Pending review', detail: 'All unresolved', value: totals.pending, icon: Clock3, color: 'text-slate-500' },
    { label: 'Flagged anomalies', detail: 'All unresolved', value: totals.flagged, icon: ShieldAlert, color: 'text-violet-600' },
    { label: 'Verified observations', detail: 'Observed in 24h', value: totals.verifiedObservations, icon: ShieldCheck, color: 'text-blue-600' },
  ];
  return (
    <section className={`${PANEL_CLASS} flex h-full flex-col`} aria-label="Workload summary">
      <PanelHeading title="Workload summary" />
      <div className="flex-1 divide-y divide-slate-100">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center gap-2.5 px-4 py-2">
            <metric.icon className={`h-3.5 w-3.5 shrink-0 ${metric.color}`} />
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-xs font-medium text-slate-700">{metric.label}</span>
              <span className="text-[9px] text-slate-400">{metric.detail}</span>
            </span>
            <span className="text-lg font-bold leading-none text-slate-900 tabular-nums">{metric.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 px-4 py-2">
        <button type="button" onClick={onReview} className="w-full rounded-md bg-gakit-maroon px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-maroon-800">Open report management</button>
      </div>
    </section>
  );
}

export function ReportInflow({ snapshot, onBrowse }: { snapshot: DashboardSnapshot; onBrowse: () => void }) {
  const [selectedAt, setSelectedAt] = useState<string | null>(null);
  const rows = snapshot.hourly;
  const { delta, peak } = inflowSummary(snapshot);
  const selected = rows.find((row) => row.at === selectedAt) ?? rows.at(-1);
  const interval = selected ? inflowInterval(selected, snapshot) : null;
  const maximum = Math.max(2, ...rows.map((row) => row.count));
  const step = Math.max(1, Math.ceil(maximum / 3));
  const ceiling = step * 3;
  const ticks = [ceiling, step * 2, step, 0];
  const labels = [...new Set([0, Math.floor(rows.length / 3), Math.floor(rows.length * 2 / 3), rows.length - 1])];
  return (
    <section className={`${PANEL_CLASS} h-full`} aria-label="Report inflow">
      <PanelHeading title="Report Inflow" action={<button type="button" onClick={onBrowse} className="text-[10px] font-semibold text-gakit-maroon">View reports ↗</button>} />
      <div className="px-4 pb-3 pt-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex items-baseline gap-2">
            <strong className="text-2xl font-bold leading-none tracking-tight text-slate-900 tabular-nums">{snapshot.totals.submissions.toLocaleString()}</strong>
            <span className="text-[10px] text-slate-500">received · last 24h</span>
            <span className="text-[10px] font-semibold text-slate-600" title={`Previous 24 hours: ${snapshot.totals.previousSubmissions}`}>
              {delta > 0 ? '+' : ''}{delta} vs prior 24h
            </span>
          </div>
          <div className="text-[10px] text-slate-500">
            Last hour <b className="text-slate-700">{snapshot.totals.lastHourSubmissions}</b>
            {peak && <> · Peak full hour <b className="text-slate-700">{peak.count}</b> at {manilaTime(peak.at)}</>}
          </div>
        </div>
        <div className="flex h-20 gap-2" aria-label="Hourly submissions by current validation status">
          <div className="flex w-5 shrink-0 flex-col justify-between text-right text-[9px] leading-none text-slate-400" aria-hidden>
            {ticks.map((tick) => <span key={tick}>{tick}</span>)}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
              {ticks.map((tick) => <span key={tick} className="border-t border-slate-100" />)}
            </div>
            <div className="absolute inset-0 flex items-end gap-1">
              {rows.map((hour) => {
                const bounds = inflowInterval(hour, snapshot);
                const description = `${manilaTime(bounds.start, true)}–${manilaTime(bounds.end)}${bounds.partial ? ' (partial)' : ''}: ${hour.count} received; ${INFLOW_STATUSES.map((status) => `${hour[status.key]} ${status.label.toLowerCase()}`).join(', ')}`;
                return (
                  <button type="button" key={hour.at} onClick={() => setSelectedAt(hour.at)}
                    onFocus={() => setSelectedAt(hour.at)} onMouseEnter={() => setSelectedAt(hour.at)}
                    aria-label={description} title={description} aria-pressed={selected?.at === hour.at}
                    className={`relative flex h-full min-w-0 flex-1 items-end rounded-t outline-offset-2 ${selected?.at === hour.at ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                    <span className={`flex w-full flex-col-reverse overflow-hidden rounded-t-sm ${bounds.partial ? 'opacity-60' : ''}`}
                      style={{ height: `${hour.count / ceiling * 100}%` }}>
                      {INFLOW_STATUSES.map((status) => <span key={status.key} style={{ background: status.color, height: `${hour.count ? hour[status.key] / hour.count * 100 : 0}%` }} />)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mb-2 ml-7 mt-1 flex justify-between text-[9px] text-slate-400" aria-hidden>
          {labels.map((index) => rows[index] && <span key={index}>{manilaTime(rows[index].at)}</span>)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap gap-x-2.5 gap-y-1">
            {INFLOW_STATUSES.map((status) => <span key={status.key} className="flex items-center gap-1 text-[9px] text-slate-500"><span className="h-1.5 w-1.5 rounded-sm" style={{ background: status.color }} />{status.label}</span>)}
          </div>
          <span className="text-[9px] text-slate-400">Current status · PHT · faded = partial hour</span>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500" aria-live="polite">
          {selected && interval ? <><span className="font-semibold text-slate-700">{manilaTime(interval.start)}–{manilaTime(interval.end)}{interval.partial ? ' (partial)' : ''}</span> · {selected.count} received · {selected.verified} verified, {selected.pending} pending, {selected.flagged} anomalies, {selected.rejected} rejected</> : 'No submissions in the selected period.'}
        </p>
      </div>
    </section>
  );
}

export function GeographicHighlights({ snapshot, kind, onBrowse }: {
  snapshot: DashboardSnapshot;
  kind: 'depth' | 'hotspots';
  onBrowse: () => void;
}) {
  const isDepth = kind === 'depth';
  const rows = [...snapshot.barangays].sort((a, b) => isDepth
    ? b.maxDepthCm - a.maxDepthCm || b.total - a.total || a.name.localeCompare(b.name)
    : b.total - a.total || b.maxDepthCm - a.maxDepthCm || a.name.localeCompare(b.name)).slice(0, 3);
  const Icon = isDepth ? Waves : MapPin;
  return (
    <section className={`${PANEL_CLASS} flex h-full flex-col`} aria-label={isDepth ? 'Peak flood depths' : 'Report hotspots'}>
      <PanelHeading title={isDepth ? 'Peak depths' : 'Report hotspots'} action={<Icon className="h-3.5 w-3.5 text-slate-400" />} />
      <div className="flex-1 divide-y divide-slate-100 px-4">
        {rows.length ? rows.map((area, index) => (
          <div key={area.id} className="flex items-center gap-2 py-2">
            <span className="text-[10px] font-semibold text-slate-400">{index + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-700">{area.name}</span>
              <span className="mt-0.5 block text-[9px] text-slate-400">{isDepth ? `Latest · ${manilaTime(area.latestObservedAt)}` : `${area.verified} verified · ${area.pending + area.flagged} to review`}</span>
            </span>
            <span className={`shrink-0 rounded px-1.5 py-1 text-[10px] font-bold tabular-nums ${isDepth && area.maxDepthCm >= 159 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{isDepth ? `${area.maxDepthCm} cm` : area.total}</span>
          </div>
        )) : <p className="py-8 text-xs text-slate-500">No recent observations matched a barangay.</p>}
      </div>
      <div className="border-t border-slate-100 px-4 py-2 text-[9px] leading-relaxed text-slate-400">
        Observed in 24h · rejected excluded.
        <div className="mt-1 flex items-center justify-between gap-1">
          <button type="button" onClick={onBrowse} className="text-[10px] font-semibold text-gakit-maroon">Browse reports ↗</button>
          {!isDepth && snapshot.totals.unlocated > 0 && <span title="Recent observations outside matched barangay boundaries">{snapshot.totals.unlocated} unmatched</span>}
        </div>
      </div>
    </section>
  );
}
