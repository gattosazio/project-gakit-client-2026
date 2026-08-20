'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import { fetchReportStats, listReports as fetchReports } from '../reports/actions/reports';
import type { Report, ReportStats } from '@/types/report';
import { DEPTH_LABELS, STATUS_META, formatDateTime } from '@/lib/reportFormatting';

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
    { label: 'Critical Reports', value: String(criticalCount), detail: 'Head-deep or higher', icon: AlertTriangle, color: 'text-hazard-critical' },
    { label: 'Verified Reports', value: String(verifiedCount), detail: 'Trusted map pins', icon: CheckCircle2, color: 'text-hazard-safe' },
  ];

  const emergencyLevel =
    criticalCount >= 5 ? 'Elevated' : criticalCount > 0 ? 'Watch' : 'Normal';

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-canvas-grey bg-white p-10 shadow-sm text-sm text-slate-500">
        Loading dashboard data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Could not load dashboard data: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <div key={metric.label} className="bg-white border border-canvas-grey rounded-lg p-4 md:p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-500">{metric.label}</div>
                  <div className="text-3xl font-bold text-slate-900 mt-2">{metric.value}</div>
                </div>
                <Icon className={`w-6 h-6 ${metric.color}`} />
              </div>
              <div className="text-xs text-slate-500 mt-4">{metric.detail}</div>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="hidden xl:block xl:col-span-2 bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
          <div className="p-5 border-b border-canvas-grey flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Latest Reports</h2>
              <p className="text-sm text-slate-500">Newest flood reports from the public map.</p>
            </div>
            <MapPin className="w-5 h-5 text-gakit-maroon" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas-light text-slate-500">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">ID</th>
                  <th className="text-left font-semibold px-5 py-3">Location</th>
                  <th className="text-left font-semibold px-5 py-3">Depth</th>
                  <th className="text-left font-semibold px-5 py-3">Status</th>
                  <th className="text-left font-semibold px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas-grey">
                {latestReports.map((report) => {
                  const status = STATUS_META[report.status];
                  return (
                    <tr key={report.id}>
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

        <div className="bg-gakit-maroon text-white rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6" />
            <h2 className="font-bold">Emergency Status</h2>
          </div>
          <div className="text-4xl font-bold mt-6">{emergencyLevel}</div>
          <p className="text-sm text-white/80 mt-3">
            {criticalCount === 0
              ? 'No head-deep or overhead reports on file. Keep monitoring live submissions.'
              : `${criticalCount} report${criticalCount === 1 ? ' is' : 's are'} marked critical. Prioritize validation and responder review.`}
          </p>
          <button
            onClick={onReviewCritical}
            className="mt-6 w-full py-3 rounded-lg bg-white text-gakit-maroon font-semibold hover:bg-white/90 transition-colors"
          >
            Review Critical Reports
          </button>
        </div>
      </section>

      <section className="bg-white border border-canvas-grey rounded-lg p-5 shadow-sm">
        <div className="flex flex-col gap-4 mb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Reports Over Time</h2>
            <p className="text-sm text-slate-500">
              Monthly public report volume for {selectedYear}.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
            >
              {years.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-bar-chart">
          {monthlyReports.map((item) => (
            <div key={item.month} className="admin-bar-item">
              <div className="admin-bar-value">{item.reports}</div>
              <div
                className="admin-bar"
                style={{ height: `${Math.max(12, (item.reports / maxMonthlyReports) * 100)}%` }}
                title={`${item.month} ${selectedYear}: ${item.reports} reports`}
              />
              <div className="admin-bar-label">{item.month}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
