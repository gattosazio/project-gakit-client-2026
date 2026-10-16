'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock3, RefreshCw } from 'lucide-react';
import { fetchDashboardSnapshot, fetchReportStats } from '../reports/actions/reports';
import type { Report, ReportStats, ReportStatus } from '@/types/report';
import type { DashboardSnapshot } from '@/types/dashboard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useWeatherFeeds } from '@/lib/weather/weatherStore';
import { ArchiveSection } from './ArchiveSection';
import { StatusStrip } from './StatusStrip';
import {
  GeographicHighlights,
  PANEL_CLASS,
  PriorityReports,
  ReportInflow,
  WorkloadSummary,
} from './OperationalPanels';
import { manilaTime, sourceState } from './operational';
import './DashboardOverview.css';

const CURRENT_YEAR = String(new Date().getFullYear());

export interface DashboardReviewOptions {
  status?: ReportStatus;
  reportId?: string;
  time?: '24h' | 'all';
}

export function DashboardOverview({
  active = true,
  onReviewReports,
}: {
  active?: boolean;
  onReviewReports?: (options?: DashboardReviewOptions) => void;
}) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reload, setReload] = useState(0);
  const [clock, setClock] = useState(0);
  const feeds = useWeatherFeeds();

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let generation = 0;
    const load = async () => {
      clearTimeout(timer);
      controller?.abort();
      controller = new AbortController();
      const request = ++generation;
      setRefreshing(true);
      setClock(Date.now());
      try {
        const data = await fetchDashboardSnapshot(controller.signal);
        if (stopped || generation !== request) return;
        setSnapshot(data);
        setError(null);
      } catch (failure) {
        if (stopped || generation !== request || controller.signal.aborted) return;
        setError(
          failure instanceof Error ? failure.message : 'Report data could not be refreshed.'
        );
      } finally {
        if (!stopped && generation === request) {
          setRefreshing(false);
          setClock(Date.now());
          timer = setTimeout(() => {
            if (document.visibilityState === 'visible') void load();
          }, 30_000);
        }
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'visible') void load();
      else {
        generation++;
        controller?.abort();
      }
    };
    if (document.visibilityState === 'visible') void load();
    document.addEventListener('visibilitychange', visibility);
    const clockTimer = setInterval(() => setClock(Date.now()), 30_000);
    return () => {
      stopped = true;
      generation++;
      controller?.abort();
      clearTimeout(timer);
      clearInterval(clockTimer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [active, reload]);

  useEffect(() => {
    if (!active) return;
    // This action shares an in-flight cache with other views. Cancelling its
    // network request would also cancel those subscribers (and Strict Mode's remount).
    let cancelled = false;
    void fetchReportStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active, reload, snapshot?.asOf]);

  const years = useMemo(() => {
    const available = new Set(stats?.years.map(String) ?? []);
    available.add(CURRENT_YEAR);
    return Array.from(available).sort().reverse();
  }, [stats]);
  const monthly = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => ({
        month: new Date(2020, month, 1).toLocaleString('en', { month: 'short' }),
        reports:
          stats?.monthly.find((row) => String(row.year) === selectedYear && row.month === month + 1)
            ?.reports ?? 0,
      })),
    [stats, selectedYear]
  );
  const now = clock || (snapshot ? Date.parse(snapshot.asOf) : 0);
  const openReport = (report: Report) => onReviewReports?.({ reportId: report.id, time: 'all' });
  const delayed = !!snapshot && (error !== null || sourceState(snapshot.asOf, now, 2) !== 'fresh');
  const advisoryDelayed = feeds.alerts.status === 'error' ||
    sourceState(feeds.alerts.checkedAt, now, 15) !== 'fresh';

  return (
    <div className="space-y-2.5" data-testid="compact-dashboard">
      <StatusStrip
        current={feeds.current.data}
        alerts={feeds.alerts.data}
        alertsCheckedAt={feeds.alerts.checkedAt}
        alertsError={
          feeds.alerts.status === 'error' ||
          (!!clock &&
            !!feeds.alerts.checkedAt &&
            sourceState(feeds.alerts.checkedAt, clock, 15) !== 'fresh')
        }
        currentError={
          feeds.current.status === 'error' ||
          (!!clock &&
            !!feeds.current.data &&
            sourceState(feeds.current.data.observedAt, clock, 120) !== 'fresh')
        }
        asOf={clock ? new Date(clock).toISOString() : undefined}
      />
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
        >
          <p>
            {snapshot
              ? 'Report refresh failed. Showing the last successful snapshot; its timestamp is shown below.'
              : `The report dashboard could not load. ${error}`}
          </p>
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            className="font-bold underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}
      {!snapshot && !error && (
        <div className="space-y-4" aria-busy="true" aria-label="Loading report dashboard">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,1fr)]">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        </div>
      )}
      {snapshot && (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,1fr)]">
            <PriorityReports
              snapshot={snapshot}
              onOpen={openReport}
              onBrowse={(status) => onReviewReports?.({ status, time: 'all' })}
            />
            <WorkloadSummary snapshot={snapshot} onReview={() => onReviewReports?.({ time: 'all' })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <ReportInflow snapshot={snapshot} onBrowse={() => onReviewReports?.({ time: '24h' })} />
            </div>
            <GeographicHighlights snapshot={snapshot} kind="depth" onBrowse={() => onReviewReports?.({ time: 'all' })} />
            <GeographicHighlights snapshot={snapshot} kind="hotspots" onBrowse={() => onReviewReports?.({ time: 'all' })} />
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[10px] text-slate-500">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {snapshot && <span className={`inline-flex items-center gap-1 ${delayed ? 'text-amber-700' : ''}`}>
            <Clock3 className="h-3 w-3" />{delayed ? 'Last available snapshot' : 'Updated'} {manilaTime(snapshot.asOf)} PHT
          </span>}
          <span className={advisoryDelayed ? 'text-amber-700' : ''}>
            Advisories: {!feeds.alerts.checkedAt && feeds.alerts.status !== 'error' ? 'checking' : advisoryDelayed ? 'update unavailable' : 'retrieved'}
          </span>
          {snapshot && <span>{snapshot.automation.enabled ? `${snapshot.automation.queued} assessments queued` : 'Background reassessment paused'}</span>}
          {snapshot && snapshot.automation.failed > 0 && snapshot.automation.firstFailedReportId && (
            <button type="button" className="font-semibold text-amber-700 underline underline-offset-2"
              onClick={() => onReviewReports?.({ reportId: snapshot.automation.firstFailedReportId!, time: 'all' })}>
              {snapshot.automation.failed} failed assessment{snapshot.automation.failed === 1 ? '' : 's'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a href="/" target="_blank" rel="noreferrer" className="font-semibold text-gakit-maroon">Open map ↗</a>
          <button type="button" onClick={() => setReload((value) => value + 1)} disabled={refreshing}
            className="inline-flex items-center gap-1 font-semibold text-slate-600 disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} /> Refresh
          </button>
        </div>
      </div>
      {stats ? <ArchiveSection monthly={monthly} years={years} selectedYear={selectedYear} onYearChange={setSelectedYear}
          active={active} refreshKey={selectedYear === CURRENT_YEAR ? `${snapshot?.asOf ?? ''}:${reload}` : reload} />
        : snapshot && <div className={`${PANEL_CLASS} px-4 py-2 text-[10px] text-slate-500`}>Submission archive is currently unavailable.</div>}
    </div>
  );
}
