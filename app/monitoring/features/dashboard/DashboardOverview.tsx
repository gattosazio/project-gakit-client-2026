'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import { fetchReportStats, listReports } from '../reports/actions/reports';
import type { Report, ReportStats, ReportStatus } from '@/types/report';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useActiveAlerts, useCurrentWeather } from '@/lib/weather/weatherStore';
import {
  buildQueue,
  comparePeriods,
  deepestSpots,
  hourlyBuckets,
  queueCounts,
  topSpots,
} from './aggregate';
import { ArchiveSection } from './ArchiveSection';
import { AttentionQueue } from './AttentionQueue';
import { StatusStrip } from './StatusStrip';
import { TodayActivity } from './TodayActivity';
import './DashboardOverview.css';

const CURRENT_YEAR = String(new Date().getFullYear());
const WINDOW_HOURS = 24;
const POLL_INTERVAL_MS = 30_000;

export function DashboardOverview({
  active = true,
  onReviewReports,
}: {
  active?: boolean;
  onReviewReports?: (options?: { status?: ReportStatus; reportId?: string }) => void;
}) {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [windowReports, setWindowReports] = useState<Report[]>([]);
  const [attentionReports, setAttentionReports] = useState<Report[]>([]);
  const [comparisonReports, setComparisonReports] = useState<Report[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(CURRENT_YEAR);
  const [snapshotAt, setSnapshotAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const currentWeather = useCurrentWeather();
  const activeAlerts = useActiveAlerts();

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        // Bucket the cutoff to 10-minute windows so the API cache key stays
        // stable between poll ticks instead of minting a new entry per minute.
        const nowMs = Date.now();
        const bucket = (timestamp: number) =>
          Math.floor(timestamp / (10 * 60_000)) * (10 * 60_000);
        const since = new Date(
          bucket(nowMs - WINDOW_HOURS * 3_600_000)
        ).toISOString();
        const since48 = new Date(
          bucket(nowMs - 48 * 3_600_000)
        ).toISOString();

        const base = {
          limit: 100,
          created_after: since,
          sort_by: 'createdAt' as const,
          sort_dir: 'desc' as const,
        };
        // The 48h list feeds the "vs previous 24h" comparison; the split
        // happens client-side against absolute timestamps.
        const base48 = { ...base, created_after: since48 };
        const [statsResult, windowResult, unverifiedResult, anomalyResult, comparisonResult] =
          await Promise.all([
            fetchReportStats(),
            listReports(base),
            listReports({ ...base, status: 'UNVERIFIED' }),
            listReports({ ...base, status: 'ANOMALY' }),
            listReports(base48),
          ]);
        if (cancelled) return;

        const attentionMap = new Map<string, Report>();
        for (const report of [...unverifiedResult.items, ...anomalyResult.items]) {
          attentionMap.set(report.id, report);
        }

        hasLoadedRef.current = true;
        setStats(statsResult);
        setWindowReports(windowResult.items);
        setAttentionReports(Array.from(attentionMap.values()));
        setComparisonReports(comparisonResult.items);
        setSnapshotAt(new Date(nowMs));
        setError(null);
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        // Only surface errors before the first successful load; keep showing
        // existing data if a background refresh transiently fails.
        if (!hasLoadedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
          setLoading(false);
        }
      }
    };

    const isVisible = () => document.visibilityState === 'visible';

    const startPolling = () => {
      if (timer != null) return;
      timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibility = () => {
      if (isVisible()) {
        void load();
        startPolling();
      } else {
        stopPolling();
      }
    };

    void load();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [active]);

  const years = useMemo(() => {
    const yearSet = new Set(stats?.years.map(String) ?? []);
    if (yearSet.size === 0) yearSet.add(CURRENT_YEAR);
    return Array.from(yearSet).sort().reverse();
  }, [stats]);

  const monthlyReports = useMemo(() => {
    const byMonth = new Array(12).fill(0);
    for (const item of stats?.monthly ?? []) {
      if (String(item.year) === selectedYear) {
        byMonth[item.month - 1] = item.reports;
      }
    }
    return byMonth.map((count, monthIndex) => ({
      month: new Date(2020, monthIndex, 1).toLocaleString('en', { month: 'short' }),
      reports: count as number,
    }));
  }, [stats, selectedYear]);

  // Snapshot timestamp captured at the last successful poll. Keeping it in
  // state (rather than calling Date.now() during render) keeps relative age
  // labels stable between polls.
  const now = snapshotAt?.getTime() ?? 0;
  const queue = useMemo(() => buildQueue(attentionReports, now), [attentionReports, now]);
  const counts = useMemo(() => queueCounts(attentionReports), [attentionReports]);
  const hourly = useMemo(
    () => hourlyBuckets(windowReports, WINDOW_HOURS, now),
    [windowReports, now]
  );
  const comparison = useMemo(
    () => comparePeriods(comparisonReports, now),
    [comparisonReports, now]
  );
  const deepSpots = useMemo(() => deepestSpots(windowReports), [windowReports]);
  const spots = useMemo(() => topSpots(windowReports), [windowReports]);
  const verifiedInWindow = useMemo(
    () => windowReports.filter((report) => report.status === 'VERIFIED').length,
    [windowReports]
  );

  const handleReview = (reportId: string, status: ReportStatus) =>
    onReviewReports?.({ status, reportId });
  const handleViewAll = (status: ReportStatus) =>
    onReviewReports?.({ status });

  if (loading) {
    return (
      <>
        <SkeletonCard lines={2} className="shadow-[0_12px_30px_rgba(15,23,42,0.06)]" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(19rem,1fr)]">
          <SkeletonCard lines={6} className="shadow-[0_12px_30px_rgba(15,23,42,0.06)]" />
          <SkeletonCard lines={4} className="shadow-[0_12px_30px_rgba(15,23,42,0.06)]" />
        </div>
        <SkeletonCard header={false} lines={6} className="shadow-[0_12px_30px_rgba(15,23,42,0.06)]" />
      </>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Could not load dashboard data: {error}
      </div>
    );
  }

  const needsActionNow = counts.critical + counts.flagged;
  const workload = [
    {
      label: 'Need action now',
      value: needsActionNow,
      detail: 'Critical + flagged, last 24h',
      icon: AlertTriangle,
      color: 'text-hazard-critical',
    },
    {
      label: 'Pending review',
      value: counts.pending,
      detail: 'Unverified, last 24h',
      icon: Clock,
      color: 'text-hazard-pending',
    },
    {
      label: 'Verified',
      value: verifiedInWindow,
      detail: 'Confirmed, last 24h',
      icon: CheckCircle2,
      color: 'text-hazard-safe',
    },
    {
      label: 'Received today',
      value: stats?.reportsToday ?? 0,
      detail: 'All reports, today',
      icon: FileText,
      color: 'text-gakit-maroon',
    },
  ];

  return (
    <>
      <StatusStrip current={currentWeather} alerts={activeAlerts} />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(19rem,1fr)]">
        <AttentionQueue
          items={queue}
          counts={counts}
          onReview={handleReview}
          onViewAll={handleViewAll}
        />

        <div className="flex min-h-[16rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 md:p-6">
            <div>
              <h2 className="font-bold text-slate-900">Workload</h2>
              <p className="mt-1 text-sm text-slate-500">
                What drifted through the last 24 hours.
              </p>
            </div>
          </div>
          <div className="flex-1 divide-y divide-slate-100">
            {workload.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="flex items-center justify-between px-5 py-3.5 md:px-6">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${metric.color}`} />
                    <div>
                      <div className="text-sm font-medium text-slate-600">{metric.label}</div>
                      <div className="text-xs text-slate-400">{metric.detail}</div>
                    </div>
                  </div>
                  <span className="text-2xl font-bold tracking-[-0.02em] text-slate-900 tabular-nums">
                    {metric.value}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-100 p-4 md:p-5">
            <button
              type="button"
              onClick={() => (counts.pending > 0 ? handleViewAll('UNVERIFIED') : onReviewReports?.())}
              className="w-full rounded-xl bg-gakit-maroon px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-maroon-800"
            >
              {counts.pending > 0
                ? `Review ${counts.pending} pending report${counts.pending === 1 ? '' : 's'}`
                : 'Open report management'}
            </button>
          </div>
        </div>
      </section>

      <TodayActivity
        hourly={hourly}
        comparison={comparison}
        deepSpots={deepSpots}
        spots={spots}
      />

      <ArchiveSection
        monthly={monthlyReports}
        years={years}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
      />
    </>
  );
}