'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CloudRain,
  Eye,
  Filter,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { FilterDropdown, type FilterDropdownOption } from '@/components/ui/FilterDropdown';
import { DEPTH_LABELS, formatDateTime } from '@/lib/reports/reportFormatting';
import {
  dismissNotifications,
  fetchNotificationReceipts,
  markNotificationsRead,
  subscribeToReceiptChanges,
} from '@/lib/notifications/receipts';
import { fetchAlertHistory } from '@/lib/weather/weather';
import type { Report } from '@/types/report';
import type { WeatherAlert as WeatherAlertType } from '@/types/weather';
import {
  createNotifications,
  mapWeatherAlertToNotification,
  type Notification,
  type NotificationType,
  type Severity,
} from '@/lib/notifications';
import { useSortableTable, type SortState } from '@/hooks/useSortableTable';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { ReportsPagination } from '../reports/ReportsPagination';
import { listReports } from '../reports/actions/reports';

import {
  NotificationTypeBadge,
  SeverityBadge,
  TYPE_META,
  SEVERITY_CLASS,
} from './components/AlertBadges';
import { NotificationRow } from './components/NotificationRow';
import { NotificationCard } from './components/NotificationCard';
import { DismissAlertModal } from './components/DismissAlertModal';
import { EmptyNotifications } from './components/EmptyNotifications';

type SortColumn = 'type' | 'location' | 'severity' | 'depth' | 'sentAt';

const NOTIFICATIONS_PER_PAGE = 25;

const DATE_FILTER_OPTIONS: FilterDropdownOption<'24h' | '7d' | 'all'>[] = [
  { value: '24h', label: 'Last 24 hours', icon: <Clock className="h-4 w-4 shrink-0" /> },
  { value: '7d', label: 'Last 7 days', icon: <Clock className="h-4 w-4 shrink-0" /> },
  { value: 'all', label: 'All time', icon: <Clock className="h-4 w-4 shrink-0" /> },
];

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
  const notificationParam = searchParams.get('notification');
  const [activeHighlightedId, setActiveHighlightedId] = useState<string | null>(notificationParam);
  const [reports, setReports] = useState<Report[]>([]);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | NotificationType>('all');
  const [dateFilter, setDateFilter] = useState<'24h' | '7d' | 'all'>('24h');
  const [dismissConfirmId, setDismissConfirmId] = useState<string | null>(null);
  const [readCollapsed, setReadCollapsed] = useState(false);
  const [unreadCollapsed, setUnreadCollapsed] = useState(false);
  const { sort, toggleSort } = useSortableTable<SortColumn>({
    column: 'sentAt',
    direction: 'desc',
  });

  // Sync the highlight with the notification URL param. Deferred to a microtask
  // so it isn't a synchronous setState inside the effect body (and respects any
  // manual click-away clear until the param actually changes).
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setActiveHighlightedId(notificationParam);
    });
    return () => {
      cancelled = true;
    };
  }, [notificationParam]);

  // Click-away listener: dismisses the maroon highlight when clicking outside the highlighted row/card
  useEffect(() => {
    if (!activeHighlightedId) return;

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(`[data-highlighted-notification="${activeHighlightedId}"]`)) {
        setActiveHighlightedId(null);
      }
    };

    window.addEventListener('mousedown', handleClickAway);
    return () => window.removeEventListener('mousedown', handleClickAway);
  }, [activeHighlightedId]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      try {
        const [reportsResult, weatherResult] = await Promise.all([
          listReports({ limit: 100 }),
          fetchAlertHistory(0, 50).catch(() => ({ items: [], total: 0, offset: 0, limit: 50 })),
        ]);
        if (!cancelled) {
          setReports(reportsResult.items);
          setWeatherAlerts(weatherResult.items);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Unable to load notifications.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

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

  const unreadNotifications = useMemo(
    () =>
      visibleNotifications.filter(
        (notification) => !readIds.includes(notification.id)
      ),
    [visibleNotifications, readIds]
  );
  const readNotifications = useMemo(
    () =>
      visibleNotifications.filter((notification) =>
        readIds.includes(notification.id)
      ),
    [visibleNotifications, readIds]
  );

  const [page, setPage] = useState(1);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setPage(1);
    });
    return () => {
      cancelled = true;
    };
  }, [filter, dateFilter, sort]);

  const orderedNotifications = useMemo(
    () => [...unreadNotifications, ...readNotifications],
    [unreadNotifications, readNotifications]
  );
  const totalPages = Math.max(
    1,
    Math.ceil(orderedNotifications.length / NOTIFICATIONS_PER_PAGE)
  );
  const safePage = Math.min(page, totalPages);
  const pagedNotifications = useMemo(
    () =>
      orderedNotifications.slice(
        (safePage - 1) * NOTIFICATIONS_PER_PAGE,
        safePage * NOTIFICATIONS_PER_PAGE
      ),
    [orderedNotifications, safePage]
  );
  const pagedUnreadNotifications = useMemo(
    () => pagedNotifications.filter((notification) => !readIds.includes(notification.id)),
    [pagedNotifications, readIds]
  );
  const pagedReadNotifications = useMemo(
    () => pagedNotifications.filter((notification) => readIds.includes(notification.id)),
    [pagedNotifications, readIds]
  );

  const dismissTarget = dismissConfirmId
    ? notifications.find((n) => n.id === dismissConfirmId) ?? null
    : null;

  useEffect(() => {
    if (!dismissConfirmId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDismissConfirmId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismissConfirmId]);

  const markAllAsRead = useCallback(() => {
    const ids = unreadNotifications.map((n) => n.id);
    if (ids.length === 0) return;
    setReadIds((cur) => [...new Set([...cur, ...ids])]);
    void markNotificationsRead(ids);
    setReadCollapsed(false);
  }, [unreadNotifications]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-canvas-grey bg-white shadow-sm">
        <div className="space-y-4 border-b border-canvas-grey p-4">
          <div>
            <h3 className="font-bold text-slate-900">Notification inbox</h3>
            <p className="mt-1 text-sm text-slate-500">
              {loading ? 'Loading notifications...' : `${notifications.length} notifications`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
            {([
              ['all', 'All', Filter],
              ['new-report', 'New reports', BellRing],
              ['needs-review', 'Needs review', ShieldAlert],
              ['flagged', 'Flagged', AlertTriangle],
              ['weather', 'Weather', CloudRain],
              ['rejected', 'Rejected', CheckCircle2],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value as 'all' | NotificationType)}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${
                  filter === value
                    ? 'bg-gakit-maroon text-white'
                    : 'bg-canvas-light text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            ))}
            <FilterDropdown
              value={dateFilter}
              onSelect={(v) => setDateFilter(v)}
              options={DATE_FILTER_OPTIONS}
              triggerIcon={<Clock className="h-4 w-4" />}
              triggerLabel={DATE_FILTER_OPTIONS.find((o) => o.value === dateFilter)?.label ?? 'All time'}
            />
          </div>
        </div>

        {unreadNotifications.length > 0 && !loading && !error && (
          <div className="flex justify-end border-b border-canvas-grey px-6 py-3">
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-grey bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-gakit-maroon hover:text-gakit-maroon"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark all as read
            </button>
          </div>
        )}

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
                  <tr>
                    <td colSpan={6} className="bg-canvas-light px-0 py-0">
                      <button
                        type="button"
                        onClick={() => setUnreadCollapsed((collapsed) => !collapsed)}
                        aria-expanded={!unreadCollapsed}
                        className="flex w-full items-center gap-2 px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                      >
                        {unreadCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        Unread
                      </button>
                    </td>
                  </tr>
                  {!unreadCollapsed &&
                    (pagedUnreadNotifications.length > 0 ? (
                      pagedUnreadNotifications.map((notification) => (
                        <NotificationRow
                          key={notification.id}
                          notification={notification}
                          onOpenReports={onOpenReports}
                          onSelectWeatherAlert={onSelectWeatherAlert}
                          onMarkRead={markAsRead}
                          onDismiss={setDismissConfirmId}
                          isRead={false}
                          highlighted={activeHighlightedId === notification.id}
                        />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-sm text-slate-400">
                          No unread notifications.
                        </td>
                      </tr>
                    ))}
                </tbody>
                {pagedReadNotifications.length > 0 && (
                  <tbody className={`divide-y divide-canvas-grey ${pagedUnreadNotifications.length > 0 ? 'border-t-2 border-canvas-grey' : ''}`}>
                    <tr>
                      <td colSpan={6} className="bg-canvas-light px-0 py-0">
                        <button
                          type="button"
                          onClick={() => setReadCollapsed((collapsed) => !collapsed)}
                          aria-expanded={!readCollapsed}
                          className="flex w-full items-center gap-2 px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                        >
                          {readCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          Read ({pagedReadNotifications.length})
                        </button>
                      </td>
                    </tr>
                    {!readCollapsed &&
                      pagedReadNotifications.map((notification) => (
                        <NotificationRow
                          key={notification.id}
                          notification={notification}
                          onOpenReports={onOpenReports}
                          onSelectWeatherAlert={onSelectWeatherAlert}
                          onMarkRead={markAsRead}
                          onDismiss={setDismissConfirmId}
                          isRead={true}
                          highlighted={activeHighlightedId === notification.id}
                        />
                      ))}
                  </tbody>
                )}
              </table>
            </div>
            <div className="md:hidden">
              <section className="border-b border-canvas-grey">
                <button
                  type="button"
                  onClick={() => setUnreadCollapsed((collapsed) => !collapsed)}
                  aria-expanded={!unreadCollapsed}
                  className="flex w-full items-center gap-2 bg-canvas-light px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                >
                  {unreadCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Unread
                </button>
                {!unreadCollapsed &&
                  (pagedUnreadNotifications.length > 0 ? (
                    <div className="divide-y divide-canvas-grey">
                      {pagedUnreadNotifications.map((notification) => (
                        <NotificationCard
                          key={notification.id}
                          notification={notification}
                          onOpenReports={onOpenReports}
                          onSelectWeatherAlert={onSelectWeatherAlert}
                          onMarkRead={markAsRead}
                          onDismiss={setDismissConfirmId}
                          isRead={false}
                          highlighted={activeHighlightedId === notification.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-4 text-sm text-slate-400">No unread notifications.</p>
                  ))}
              </section>
              {pagedReadNotifications.length > 0 && (
                <section className={pagedUnreadNotifications.length > 0 ? 'border-t border-canvas-grey' : ''}>
                  <button
                    type="button"
                    onClick={() => setReadCollapsed((collapsed) => !collapsed)}
                    aria-expanded={!readCollapsed}
                    className="flex w-full items-center gap-2 bg-canvas-light px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                  >
                    {readCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    Read ({pagedReadNotifications.length})
                  </button>
                  {!readCollapsed && (
                    <div className="divide-y divide-canvas-grey">
                      {pagedReadNotifications.map((notification) => (
                        <NotificationCard
                          key={notification.id}
                          notification={notification}
                          onOpenReports={onOpenReports}
                          onSelectWeatherAlert={onSelectWeatherAlert}
                          onMarkRead={markAsRead}
                          onDismiss={setDismissConfirmId}
                          isRead={true}
                          highlighted={activeHighlightedId === notification.id}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
            {totalPages > 1 && (
              <ReportsPagination
                currentPage={safePage}
                totalPages={totalPages}
                totalItems={orderedNotifications.length}
                pageSize={NOTIFICATIONS_PER_PAGE}
                onPageChange={setPage}
                itemLabel="notifications"
              />
            )}
          </>
        )}
      </div>
      <DismissAlertModal
        notification={dismissConfirmId ? dismissTarget : null}
        onClose={() => setDismissConfirmId(null)}
        onConfirm={() => {
          if (dismissConfirmId) dismiss(dismissConfirmId);
          setDismissConfirmId(null);
        }}
      />
    </section>
  );
}
