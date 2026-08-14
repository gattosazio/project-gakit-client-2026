'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Clock, RefreshCw, ShieldAlert } from 'lucide-react';
import { DEPTH_LABELS, formatDateTime } from '@/lib/reportFormatting';
import type { Report } from '@/types/report';
import { listReports } from '../reports/actions/reports';

type AlertLevel = 'urgent' | 'attention' | 'info';

interface OperationalAlert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  createdAt: string;
}

const ALERT_STYLE: Record<AlertLevel, { icon: typeof AlertTriangle; className: string }> = {
  urgent: { icon: ShieldAlert, className: 'border-red-200 bg-red-50 text-red-700' },
  attention: { icon: AlertTriangle, className: 'border-amber-200 bg-amber-50 text-amber-700' },
  info: { icon: Clock, className: 'border-blue-200 bg-blue-50 text-blue-700' },
};

function createAlerts(reports: Report[]): OperationalAlert[] {
  return reports
    .flatMap<OperationalAlert>((report): OperationalAlert[] => {
      const location = report.location.address || 'Unknown location';
      const depth = DEPTH_LABELS[report.depth.code];
      const detail = `${location} - ${depth}`;

      if (report.status === 'ANOMALY') {
        return [{ id: `flagged-${report.id}`, level: 'attention', title: 'Report flagged for review', detail, createdAt: report.updatedAt }];
      }

      if (report.status !== 'UNVERIFIED') return [];

      if (report.depth.code === 'head' || report.depth.code === 'overhead') {
        return [{ id: `critical-${report.id}`, level: 'urgent', title: 'Critical report awaits validation', detail, createdAt: report.createdAt }];
      }

      return [{ id: `pending-${report.id}`, level: 'info', title: 'New report awaits validation', detail, createdAt: report.createdAt }];
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function AlertsTab({ onOpenReports }: { onOpenReports: () => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | AlertLevel>('all');

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listReports({ limit: 100 });
      setReports(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load alerts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const alerts = useMemo(() => createAlerts(reports), [reports]);
  const urgentCount = alerts.filter((alert) => alert.level === 'urgent').length;
  const attentionCount = alerts.filter((alert) => alert.level === 'attention').length;
  const pendingCount = alerts.filter((alert) => alert.level === 'info').length;
  const visibleAlerts = filter === 'all' ? alerts : alerts.filter((alert) => alert.level === filter);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-canvas-grey bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-maroon-50 p-3 text-gakit-maroon">
            <BellRing className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gakit-maroon">Operations center</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Alerts & Notifications</h2>
            <p className="mt-1 text-sm text-slate-500">Prioritize reports that need validation or follow-up.</p>
          </div>
        </div>
        <button onClick={() => void loadAlerts()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-canvas-grey px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <AlertSummary label="Critical pending" value={urgentCount} detail="Head-deep or higher" icon={ShieldAlert} className="border-red-200 bg-red-50 text-red-700" />
        <AlertSummary label="Flagged reports" value={attentionCount} detail="Needs staff review" icon={AlertTriangle} className="border-amber-200 bg-amber-50 text-amber-700" />
        <AlertSummary label="New reports" value={pendingCount} detail="Awaiting validation" icon={Clock} className="border-blue-200 bg-blue-50 text-blue-700" />
      </div>

      <div className="overflow-hidden rounded-xl border border-canvas-grey bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-canvas-grey px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Alert Feed</h3>
            <p className="mt-1 text-sm text-slate-500">{loading ? 'Loading alerts...' : `${alerts.length} active alerts`}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'All' },
              { value: 'urgent', label: 'Critical' },
              { value: 'attention', label: 'Flagged' },
              { value: 'info', label: 'Pending' },
            ].map((option) => (
              <button key={option.value} type="button" onClick={() => setFilter(option.value as 'all' | AlertLevel)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${filter === option.value ? 'bg-gakit-maroon text-white' : 'bg-canvas-light text-slate-600 hover:bg-slate-100'}`}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="p-5 text-sm text-red-700">{error}</div>
        ) : visibleAlerts.length === 0 && !loading ? (
          <div className="p-10 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-hazard-safe" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No matching alerts</p>
            <p className="mt-1 text-sm text-slate-500">Try another filter or refresh the latest report activity.</p>
          </div>
        ) : (
          <div className="divide-y divide-canvas-grey">
            {visibleAlerts.map((alert) => {
              const style = ALERT_STYLE[alert.level];
              const Icon = style.icon;
              return (
                <div key={alert.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-canvas-light/60 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`rounded-lg border p-2 ${style.className}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{alert.title}</p>
                      <p className="mt-1 truncate text-sm text-slate-500">{alert.detail}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(alert.createdAt)}</p>
                    </div>
                  </div>
                  <button onClick={onOpenReports} className="shrink-0 rounded-lg border border-canvas-grey px-3 py-2 text-sm font-semibold text-slate-700 hover:border-gakit-maroon hover:text-gakit-maroon">
                    Open reports
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function AlertSummary({ label, value, detail, icon: Icon, className }: { label: string; value: number; detail: string; icon: typeof ShieldAlert; className: string }) {
  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-3 text-3xl font-bold leading-none">{value}</p>
          <p className="mt-2 text-xs font-medium opacity-80">{detail}</p>
        </div>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
