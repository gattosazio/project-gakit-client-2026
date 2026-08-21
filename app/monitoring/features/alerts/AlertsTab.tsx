'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  Eye,
  MapPinned,
  MoreHorizontal,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { DEPTH_LABELS, formatDateTime } from '@/lib/reportFormatting';
import {
  dismissNotifications,
  fetchNotificationReceipts,
  markNotificationsRead,
  subscribeToReceiptChanges,
} from '@/lib/notificationReceipts';
import { fetchAlertHistory } from '@/lib/weather';
import type { FloodDepthCode, Report } from '@/types/report';
import type { WeatherAlert as WeatherAlertType } from '@/types/weather';
import { listReports } from '../reports/actions/reports';

type NotificationType =
  | 'new-report'
  | 'needs-review'
  | 'flagged'
  | 'rejected'
  | 'weather';
type Severity = 'critical' | 'warning' | 'info' | 'high' | 'medium' | 'low';
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
  weatherAlert?: WeatherAlertType;
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
};

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-orange-50 text-orange-700 border-orange-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

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
  return {
    id: `weather-${alert.id}`,
    type: 'weather' as NotificationType,
    severity: alert.severity as Severity,
    title: alert.title,
    location: 'Iligan City',
    sentAt: alert.createdAt,
    weatherAlert: alert,
  };
}

export function AlertsTab({
  active = true,
  onOpenReports,
  onSelectWeatherAlert,
}: {
  active?: boolean;
  onOpenReports: (reportId?: string) => void;
  onSelectWeatherAlert?: (alert: WeatherAlertType) => void;
}) {
  const searchParams = useSearchParams();
  const highlightedNotificationId = searchParams.get('notification');
  const [reports, setReports] = useState<Report[]>([]);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | NotificationType>('all');
  const [dateFilter, setDateFilter] = useState<'24h' | '7d' | 'all'>('24h');
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

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      const receipts = await fetchNotificationReceipts();
      if (!receipts || cancelled) return;
      setReadIds(receipts.readIds);
      setDismissedIds(receipts.dismissedIds);
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  // Keep inbox in sync with changes made on other surfaces (header bell)
  useEffect(
    () =>
      subscribeToReceiptChanges((kind, ids) => {
        if (kind === 'read') setReadIds((cur) => [...new Set([...cur, ...ids])]);
        else setDismissedIds((cur) => [...new Set([...cur, ...ids])]);
      }),
    []
  );

  const markAsRead = useCallback((id: string) => {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]));
    void markNotificationsRead([id]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissedIds((current) => (current.includes(id) ? current : [...current, id]));
    void dismissNotifications([id]);
  }, []);

  const notifications = useMemo(
    () => [
      ...createNotifications(reports),
      ...weatherAlerts.map(mapWeatherAlertToNotification),
    ],
    [reports, weatherAlerts]
  );

  const visibleNotifications = useMemo(() => {
    const notDismissed = notifications.filter(
      (notification) => !dismissedIds.includes(notification.id)
    );
    const typeFiltered =
      filter === 'all'
        ? notDismissed
        : notDismissed.filter((notification) => notification.type === filter);

    const now = new Date();
    const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
    const dateFiltered = typeFiltered.filter((notification) => {
      if (dateFilter === 'all') return true;
      if (dateFilter === '24h') return new Date(notification.sentAt).getTime() >= cutoff;
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
  }, [dateFilter, dismissedIds, filter, notifications, sort]);

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
      <div className="rounded-xl border border-canvas-grey bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-canvas-grey px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Notification inbox</h3>
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
            <select
              aria-label="Notification date range"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as '24h' | '7d' | 'all')}
              className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-gakit-maroon focus:border-gakit-maroon"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="p-5 text-sm text-red-700">{error}</div>
        ) : visibleNotifications.length === 0 && !loading ? (
          <EmptyNotifications />
        ) : (
          <>
            <div className="hidden md:block">
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
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      onOpenReports={onOpenReports}
                      onSelectWeatherAlert={onSelectWeatherAlert}
                      onMarkRead={markAsRead}
                      onDismiss={dismiss}
                      isRead={readIds.includes(notification.id)}
                      highlighted={highlightedNotificationId === notification.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-canvas-grey md:hidden">
              {visibleNotifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onOpenReports={onOpenReports}
                  onSelectWeatherAlert={onSelectWeatherAlert}
                  onMarkRead={markAsRead}
                  onDismiss={dismiss}
                  isRead={readIds.includes(notification.id)}
                  highlighted={highlightedNotificationId === notification.id}
                />
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
    <th className="px-6 py-3 font-semibold text-left">
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
  onSelectWeatherAlert,
  onMarkRead,
  onDismiss,
  isRead,
  highlighted,
}: {
  notification: Notification;
  onOpenReports: (reportId?: string) => void;
  onSelectWeatherAlert?: (alert: WeatherAlertType) => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  isRead: boolean;
  highlighted: boolean;
}) {
  return (
    <tr className={highlighted ? 'bg-maroon-100/80' : 'hover:bg-canvas-light/60'}>
      <td className={`px-6 py-4 ${isRead ? 'opacity-60' : ''}`}>
        <NotificationTypeBadge type={notification.type} />
      </td>
      <td
        className={`max-w-56 truncate px-6 py-4 ${
          isRead ? 'text-slate-400' : 'text-slate-700'
        }`}
      >
        {notification.location}
      </td>
      <td className={`px-6 py-4 ${isRead ? 'opacity-60' : ''}`}>
        <SeverityBadge severity={notification.severity} />
      </td>
      <td className={`px-6 py-4 ${isRead ? 'text-slate-400' : 'text-slate-600'}`}>
        {notification.depth ? DEPTH_LABELS[notification.depth] : '—'}
      </td>
      <td
        className={`whitespace-nowrap px-6 py-4 ${
          isRead ? 'text-slate-400' : 'text-slate-600'
        }`}
      >
        {formatDateTime(notification.sentAt)}
      </td>
      <td className="px-6 py-4">
        <NotificationActions
          notification={notification}
          onOpenReports={onOpenReports}
          onSelectWeatherAlert={onSelectWeatherAlert}
          onMarkRead={onMarkRead}
          onDismiss={onDismiss}
          isRead={isRead}
        />
      </td>
    </tr>
  );
}

function NotificationCard({
  notification,
  onOpenReports,
  onSelectWeatherAlert,
  onMarkRead,
  onDismiss,
  isRead,
  highlighted,
}: {
  notification: Notification;
  onOpenReports: (reportId?: string) => void;
  onSelectWeatherAlert?: (alert: WeatherAlertType) => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  isRead: boolean;
  highlighted: boolean;
}) {
  return (
    <div className={`flex gap-3 p-4 ${highlighted ? 'bg-maroon-100/80' : ''}`}>
      <div className={`min-w-0 flex-1 ${isRead ? 'opacity-60' : ''}`}>
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
      <NotificationActions
        notification={notification}
        onOpenReports={onOpenReports}
        onSelectWeatherAlert={onSelectWeatherAlert}
        onMarkRead={onMarkRead}
        onDismiss={onDismiss}
        isRead={isRead}
      />
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
  onSelectWeatherAlert,
  onMarkRead,
  onDismiss,
  isRead,
}: {
  notification: Notification;
  onOpenReports: (reportId?: string) => void;
  onSelectWeatherAlert?: (alert: WeatherAlertType) => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  isRead: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const toggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        left: Math.max(8, rect.right - 176),
      });
    }
    setOpen((value) => !value);
  };

  useEffect(() => {
    if (!open) return;

    // Outside clicks are handled by the fullscreen backdrop button rendered
    // with the portal menu (same approach as report management) — a global
    // mousedown listener here would unmount the menu before item clicks fire.
    const reposition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 176) });
      }
    };

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const isWeather = notification.type === 'weather';
  const reportAction =
    notification.type === 'flagged' || notification.type === 'needs-review'
      ? 'Review report'
      : 'View report';

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Actions for ${notification.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex rounded-lg border border-canvas-grey p-2 text-slate-600 hover:border-gakit-maroon hover:text-gakit-maroon"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="fixed inset-0 z-[1300] cursor-default"
              onClick={() => setOpen(false)}
            />
            <div
              role="menu"
              style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: 176 }}
              className="z-[1400] overflow-hidden rounded-lg border border-canvas-grey bg-white shadow-lg"
            >
              {isWeather && onSelectWeatherAlert && notification.weatherAlert ? (
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onSelectWeatherAlert(notification.weatherAlert!);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-canvas-light"
                >
                  <Eye className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 text-left">View details</span>
                </button>
              ) : (
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onOpenReports(notification.reportId);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-canvas-light"
                >
                  {notification.reportId ? (
                    <Eye className="h-4 w-4 shrink-0 text-slate-400" />
                  ) : (
                    <MapPinned className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <span className="flex-1 text-left">
                    {notification.reportId ? reportAction : 'Open map'}
                  </span>
                </button>
              )}
              {!isRead && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onMarkRead(notification.id);
                  }}
                  className="flex w-full items-center gap-3 border-t border-canvas-grey px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-canvas-light"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 text-left">Mark as read</span>
                </button>
              )}
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onDismiss(notification.id);
                }}
                className="flex w-full items-center gap-3 border-t border-canvas-grey px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Dismiss permanently</span>
              </button>
            </div>
          </>,
          document.body
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
