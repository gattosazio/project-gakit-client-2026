'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  MapPinned,
  MoreHorizontal,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { DEPTH_LABELS, formatDateTime } from '@/lib/reportFormatting';
import { fetchAlertHistory } from '@/lib/weather';
import type { FloodDepthCode, Report } from '@/types/report';
import type { WeatherAlert as WeatherAlertType } from '@/types/weather';
import { listReports } from '../reports/actions/reports';

type NotificationType =
  | 'new-report'
  | 'needs-review'
  | 'flagged'
  | 'rejected'
  | 'weather'
  | 'hazard';
type Severity = 'critical' | 'high' | 'medium' | 'low';
type SortColumn = 'type' | 'location' | 'severity' | 'depth' | 'sentAt';

interface Notification {
  id: string;
  type: NotificationType;
  severity: Severity;
  title: string;
  location: string;
  depth?: FloodDepthCode;
  sentAt: string;
  reportId?: string;
}

const TYPE_META: Record<
  NotificationType,
  { label: string; icon: typeof BellRing; className: string }
> = {
  'new-report': {
    label: 'New report',
    icon: BellRing,
    className: 'bg-blue-50 text-blue-700',
  },
  'needs-review': {
    label: 'Needs review',
    icon: ShieldAlert,
    className: 'bg-amber-50 text-amber-700',
  },
  flagged: {
    label: 'Flagged',
    icon: AlertTriangle,
    className: 'bg-orange-50 text-orange-700',
  },
  rejected: {
    label: 'Rejected',
    icon: CheckCircle2,
    className: 'bg-slate-100 text-slate-600',
  },
  weather: {
    label: 'Weather alert',
    icon: CloudRain,
    className: 'bg-cyan-50 text-cyan-700',
  },
  hazard: {
    label: 'Hazard alert',
    icon: MapPinned,
    className: 'bg-indigo-50 text-indigo-700',
  },
};

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATIC_NOTIFICATIONS: Notification[] = [
  {
    id: 'weather-rainfall',
    type: 'weather',
    severity: 'high',
    title: 'Heavy rainfall advisory',
    location: 'Iligan City',
    sentAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'hazard-river',
    type: 'hazard',
    severity: 'medium',
    title: 'River level monitoring advisory',
    location: 'Mandulog River',
    sentAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
];

function createNotifications(reports: Report[]): Notification[] {
  return reports.flatMap<Notification>((report) => {
    const location = report.location.address || 'Unknown location';

    if (report.status === 'ANOMALY') {
      return [{
        id: `flagged-${report.id}`,
        type: 'flagged',
        severity: 'high',
        title: 'Report flagged for review',
        location,
        depth: report.depth.code,
        sentAt: report.updatedAt,
        reportId: report.id,
      }];
    }

    if (report.status === 'REJECTED') {
      return [{
        id: `rejected-${report.id}`,
        type: 'rejected',
        severity: 'low',
        title: 'Report was rejected',
        location,
        depth: report.depth.code,
        sentAt: report.updatedAt,
        reportId: report.id,
      }];
    }

    if (
      report.status === 'UNVERIFIED' &&
      (report.depth.code === 'head' || report.depth.code === 'overhead')
    ) {
      return [{
        id: `review-${report.id}`,
        type: 'needs-review',
        severity: 'critical',
        title: 'Critical report requires staff review',
        location,
        depth: report.depth.code,
        sentAt: report.createdAt,
        reportId: report.id,
      }];
    }

    if (report.status === 'UNVERIFIED') {
      return [{
        id: `new-${report.id}`,
        type: 'new-report',
        severity: 'medium',
        title: 'A user submitted a report',
        location,
        depth: report.depth.code,
        sentAt: report.createdAt,
        reportId: report.id,
      }];
    }

    return [];
  });
}

function mapWeatherAlertToNotification(alert: WeatherAlertType): Notification {
  const severityMap: Record<string, Severity> = {
    critical: 'critical',
    warning: 'high',
    info: 'medium',
  };
  return {
    id: `weather-${alert.id}`,
    type: 'weather' as NotificationType,
    severity: severityMap[alert.severity] ?? 'medium',
    title: alert.title,
    location: 'Iligan City',
    sentAt: alert.createdAt,
  };
}

export function AlertsTab({
  active = true,
  onOpenReports,
}: {
  active?: boolean;
  onOpenReports: (reportId?: string) => void;
}) {
  const searchParams = useSearchParams();
  const highlightedNotificationId = searchParams.get('notification');
  const [reports, setReports] = useState<Report[]>([]);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | NotificationType>('all');
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | 'all'>('today');
  const [sort, setSort] = useState<{
    column: SortColumn;
    direction: 'asc' | 'desc';
  }>({ column: 'sentAt', direction: 'desc' });

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [reportsResult, weatherResult] = await Promise.all([
        listReports({ limit: 100 }),
        fetchAlertHistory(0, 50).catch(() => ({ items: [], total: 0, offset: 0, limit: 50 })),
      ]);
      setReports(reportsResult.items);
      setWeatherAlerts(weatherResult.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load notifications.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void loadNotifications();
  }, [active, loadNotifications]);

  const notifications = useMemo(
    () => [
      ...createNotifications(reports),
      ...weatherAlerts.map(mapWeatherAlertToNotification),
      ...STATIC_NOTIFICATIONS,
    ],
    [reports, weatherAlerts]
  );

  const visibleNotifications = useMemo(() => {
    const typeFiltered =
      filter === 'all'
        ? notifications
        : notifications.filter((notification) => notification.type === filter);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateFiltered = typeFiltered.filter((notification) => {
      if (dateFilter === 'all') return true;
      if (dateFilter === 'today') return new Date(notification.sentAt) >= startOfToday;
      return new Date(notification.sentAt).getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
    });

    return [...dateFiltered].sort((a, b) => {
      const value = (notification: Notification) => {
        if (sort.column === 'depth') {
          return notification.depth ? DEPTH_LABELS[notification.depth] : '';
        }

        if (sort.column === 'sentAt') {
          return new Date(notification.sentAt).getTime();
        }

        return notification[sort.column];
      };
      const left = value(a);
      const right = value(b);
      const compared =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right));

      return sort.direction === 'asc' ? compared : -compared;
    });
  }, [dateFilter, filter, notifications, sort]);

  const toggleSort = (column: SortColumn) => {
    setSort((current) => ({
      column,
      direction:
        current.column === column && current.direction === 'desc'
          ? 'asc'
          : 'desc',
    }));
  };

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-xl border border-canvas-grey bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-canvas-grey px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Notification inbox</h3>
            <p className="mt-1 text-sm text-slate-500">
              {loading ? 'Loading notifications...' : `${notifications.length} notifications`}
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {[
              ['all', 'All'],
              ['new-report', 'New reports'],
              ['needs-review', 'Needs review'],
              ['flagged', 'Flagged'],
              ['weather', 'Weather'],
              ['hazard', 'Hazards'],
              ['rejected', 'Rejected'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value as 'all' | NotificationType)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${
                  filter === value
                    ? 'bg-gakit-maroon text-white'
                    : 'bg-canvas-light text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="relative shrink-0">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gakit-maroon" />
              <select
                aria-label="Notification date range"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value as 'today' | '7d' | 'all')}
                className="appearance-none rounded-lg border border-canvas-grey bg-white py-2 pl-9 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-colors hover:border-gakit-maroon focus:border-gakit-maroon"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="all">All time</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        </div>

        {error ? (
          <div className="p-5 text-sm text-red-700">{error}</div>
        ) : visibleNotifications.length === 0 && !loading ? (
          <EmptyNotifications />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-canvas-light text-left text-slate-500">
                  <tr>
                    <SortableHeader label="Type" column="type" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Location" column="location" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Severity" column="severity" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Depth" column="depth" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Sent" column="sentAt" sort={sort} onSort={toggleSort} />
                    <th className="px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-grey">
                  {visibleNotifications.map((notification) => (
                    <NotificationRow key={notification.id} notification={notification} onOpenReports={onOpenReports} highlighted={highlightedNotificationId === notification.id} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-canvas-grey md:hidden">
              {visibleNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} onOpenReports={onOpenReports} highlighted={highlightedNotificationId === notification.id} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SortableHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: SortColumn;
  sort: { column: SortColumn; direction: 'asc' | 'desc' };
  onSort: (column: SortColumn) => void;
}) {
  return (
    <th className="px-5 py-3 font-semibold">
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-slate-900"
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${
            sort.column === column && sort.direction === 'asc'
              ? 'rotate-180'
              : ''
          }`}
        />
      </button>
    </th>
  );
}

function NotificationRow({
  notification,
  onOpenReports,
  highlighted,
}: {
  notification: Notification;
  onOpenReports: (reportId?: string) => void;
  highlighted: boolean;
}) {
  return (
    <tr className={highlighted ? 'bg-maroon-100/80' : 'hover:bg-canvas-light/60'}>
      <td className="px-5 py-4">
        <NotificationTypeBadge type={notification.type} />
      </td>
      <td className="max-w-56 truncate px-5 py-4 text-slate-700">
        {notification.location}
      </td>
      <td className="px-5 py-4">
        <SeverityBadge severity={notification.severity} />
      </td>
      <td className="px-5 py-4 text-slate-600">
        {notification.depth ? DEPTH_LABELS[notification.depth] : '—'}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
        {formatDateTime(notification.sentAt)}
      </td>
      <td className="px-5 py-4">
        <NotificationActions notification={notification} onOpenReports={onOpenReports} />
      </td>
    </tr>
  );
}

function NotificationCard({
  notification,
  onOpenReports,
  highlighted,
}: {
  notification: Notification;
  onOpenReports: (reportId?: string) => void;
  highlighted: boolean;
}) {
  return (
    <div className={`flex gap-3 p-4 ${highlighted ? 'bg-maroon-100/80' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <NotificationTypeBadge type={notification.type} />
          <SeverityBadge severity={notification.severity} />
        </div>
        <p className="mt-3 font-semibold text-slate-900">{notification.title}</p>
        <p className="mt-1 truncate text-sm text-slate-600">{notification.location}</p>
        <p className="mt-2 text-xs text-slate-400">
          {notification.depth ? `${DEPTH_LABELS[notification.depth]} · ` : ''}
          {formatDateTime(notification.sentAt)}
        </p>
      </div>
      <NotificationActions notification={notification} onOpenReports={onOpenReports} />
    </div>
  );
}

function NotificationTypeBadge({ type }: { type: NotificationType }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold capitalize ${SEVERITY_CLASS[severity]}`}
    >
      {severity}
    </span>
  );
}

function NotificationActions({
  notification,
  onOpenReports,
}: {
  notification: Notification;
  onOpenReports: (reportId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };

    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const reportAction =
    notification.type === 'flagged' || notification.type === 'needs-review'
      ? 'Review report'
      : 'View report';

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label={`Actions for ${notification.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex rounded-lg border border-canvas-grey p-2 text-slate-600 hover:border-gakit-maroon hover:text-gakit-maroon"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-canvas-grey bg-white py-1 shadow-lg"
        >
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenReports(notification.reportId);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-canvas-light"
          >
            {notification.reportId ? reportAction : 'Open map'}
          </button>
          <button
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-canvas-light"
          >
            Mark as read
          </button>
          <button
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-canvas-light"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyNotifications() {
  return (
    <div className="p-10 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-hazard-safe" />
      <p className="mt-3 text-sm font-semibold text-slate-700">
        No matching notifications
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Try another filter or refresh the latest activity.
      </p>
    </div>
  );
}
