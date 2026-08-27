'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
} from 'lucide-react';
import { fetchReportStats, listReports as fetchReports } from '../reports/actions/reports';
import type { Report, ReportStats } from '@/types/report';
import { DEPTH_LABELS, STATUS_META, formatDateTime } from '@/lib/reports/reportFormatting';
import './DashboardOverview.css';

const CURRENT_YEAR = String(new Date().getFullYear());

export function DashboardOverview({
  active = true,
  onReviewCritical,
}: {
  active?: boolean;
  onReviewCritical?: () => void;
}) {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [latestReports, setLatestReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(CURRENT_YEAR);
  const hasLoadedRef = useRef(false);

  // Near-real-time refresh: re-fetch on an interval. The server-side cache
  // (30s, invalidated on write) keeps each poll cheap.
  const POLL_INTERVAL_MS = 30_000;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const [statsResult, reportsResult] = await Promise.all([
          fetchReportStats(),
          fetchReports({ limit: 5 }),
        ]);
        if (cancelled) return;
        hasLoadedRef.current = true;
        setStats(statsResult);
        setLatestReports(reportsResult.items);
        setError(null);
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        // Only surface errors before the first successful load; keep showing
        // existing data if a background refresh transiently fails.
        if (!hasLoadedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load reports');
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

  const reportsToday = stats?.reportsToday ?? 0;
  const pendingCount = stats?.pendingCount ?? 0;
  const verifiedCount = stats?.verifiedCount ?? 0;
  const criticalCount = stats?.criticalCount ?? 0;

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

  const maxMonthlyReports = Math.max(1, ...monthlyReports.map((item) => item.reports));

  const metrics = [
    { label: 'Reports Today', value: String(reportsToday), detail: 'From the public map', icon: FileText, color: 'text-gakit-maroon' },
    { label: 'Pending Validation', value: String(pendingCount), detail: 'Awaiting review', icon: Clock, color: 'text-hazard-pending' },
    { label: 'Critical Reports', value: String(criticalCount), detail: 'Head-deep or higher', icon: AlertTriangle, color: 'text-gakit-maroon' },
    { label: 'Verified Reports', value: String(verifiedCount), detail: 'Trusted map pins', icon: CheckCircle2, color: 'text-hazard-safe' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        Loading dashboard data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Could not load dashboard data: {error}
      </div>
    );
  }

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] md:p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-500">{metric.label}</div>
                  <div className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-900">{metric.value}</div>
                </div>
                <span className="rounded-xl bg-white p-2.5 shadow-sm">
                  <Icon className={`h-5 w-5 ${metric.color}`} />
                </span>
              </div>
              <div className="mt-4 text-xs text-slate-500">{metric.detail}</div>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(20rem,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 md:p-6">
            <div>
              <h2 className="font-bold text-slate-900">Latest Reports</h2>
              <p className="mt-1 text-sm text-slate-500">Newest flood reports from the public map.</p>
            </div>
            <span className="rounded-xl bg-maroon-50 p-2.5">
              <MapPin className="h-5 w-5 text-gakit-maroon" />
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">ID</th>
                  <th className="text-left font-semibold px-5 py-3">Location</th>
                  <th className="text-left font-semibold px-5 py-3">Depth</th>
                  <th className="text-left font-semibold px-5 py-3">Status</th>
                  <th className="text-left font-semibold px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {latestReports.map((report) => {
                  const status = STATUS_META[report.status];
                  return (
                    <tr key={report.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-900">
                        {report.id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {report.location.address || `${report.location.latitude.toFixed(4)}, ${report.location.longitude.toFixed(4)}`}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{DEPTH_LABELS[report.depth.code]}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badgeClass}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{formatDateTime(report.createdAt)}</td>
                    </tr>
                  );
                })}
                {latestReports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                      No reports submitted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 md:p-6">
            <div>
              <h2 className="font-bold text-slate-900">Report Summary</h2>
              <p className="mt-1 text-sm text-slate-500">Current report breakdown.</p>
            </div>
            <span className="rounded-xl bg-maroon-50 p-2.5">
              <FileText className="h-5 w-5 text-gakit-maroon" />
            </span>
          </div>
          <div className="flex-1 divide-y divide-slate-100">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="flex items-center justify-between px-5 py-3.5 md:px-6">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${metric.color}`} />
                    <span className="text-sm font-medium text-slate-600">{metric.label}</span>
                  </div>
                  <span className="text-lg font-bold tracking-[-0.02em] text-slate-900">{metric.value}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-100 p-4 md:p-5">
            <button
              type="button"
              onClick={onReviewCritical}
              className="w-full rounded-xl bg-gakit-maroon px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-maroon-800"
            >
              Review Critical Reports
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] md:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Reports Over Time</h2>
            <p className="mt-1 text-sm text-slate-500">
              Monthly public report volume for {selectedYear}.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition-colors focus:border-gakit-maroon"
            >
              {years.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="dashboard-bar-chart">
          {monthlyReports.map((item) => (
            <div key={item.month} className="dashboard-bar-item">
              <div className="dashboard-bar-value">{item.reports}</div>
              <div
                className="dashboard-bar"
                style={{ height: `${Math.max(12, (item.reports / maxMonthlyReports) * 100)}%` }}
                title={`${item.month} ${selectedYear}: ${item.reports} reports`}
              />
              <div className="dashboard-bar-label">{item.month}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
