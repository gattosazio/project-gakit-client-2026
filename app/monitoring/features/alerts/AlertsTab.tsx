'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Archive, CheckCircle2, Inbox } from 'lucide-react';
import {
  dismissNotifications,
  fetchNotificationReceipts,
  markNotificationsRead,
  restoreNotifications,
  subscribeToReceiptChanges,
} from '@/lib/notifications/receipts';
import {
  ACTIVE_REPORT_PAGES,
  ACTIVE_WEATHER_PAGES,
  ARCHIVED_REPORT_PAGES,
  ARCHIVED_WEATHER_PAGES,
  fetchReportPages,
  fetchWeatherPages,
} from '@/lib/notifications/feed';
import type { Report } from '@/types/report';
import type { WeatherAlert as WeatherAlertType } from '@/types/weather';
import {
  partitionArchived,
  reportNotifications,
  weatherNotifications,
  type AlertsView,
} from '@/lib/notifications/filters';

import { ReportAlertsPanel } from './components/ReportAlertsPanel';
import { WeatherAlertsPanel } from './components/WeatherAlertsPanel';
import { DismissAlertModal } from './components/DismissAlertModal';

const VIEW_OPTIONS: { value: AlertsView; label: string; icon: typeof Inbox }[] = [
  { value: 'active', label: 'Active', icon: Inbox },
  { value: 'archived', label: 'Archived', icon: Archive },
];

export function AlertsTab({
  active = true,
  highlightedNotificationId = null,
  onOpenReports,
  onSelectWeatherAlert,
}: {
  active?: boolean;
  highlightedNotificationId?: string | null;
  onOpenReports: (reportId?: string) => void;
  onSelectWeatherAlert?: (alert: WeatherAlertType) => void;
}) {
  const searchParams = useSearchParams();
  const notificationParam = highlightedNotificationId ?? searchParams.get('notification');
  const [activeHighlightedId, setActiveHighlightedId] = useState<string | null>(notificationParam);
  const [reports, setReports] = useState<Report[]>([]);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [dismissConfirmId, setDismissConfirmId] = useState<string | null>(null);
  const [view, setView] = useState<AlertsView>(() =>
    searchParams.get('view') === 'archived' ? 'archived' : 'active'
  );

  // Sync the highlight with the notification URL param or prop.
  useEffect(() => {
    setActiveHighlightedId(notificationParam);
  }, [notificationParam]);

  // Click-away listener: dismisses the maroon highlight when clicking outside
  // the highlighted row/card.
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

  // Keep ?view= in the address bar so a refresh or Back returns to the same
  // segment, without a server round-trip. Matches MonitoringShell's popstate
  // convention: replaceState doesn't notify React, so re-read on Back/Forward.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (view === 'archived') params.set('view', 'archived');
    else params.delete('view');
    const query = params.toString();
    window.history.replaceState(null, '', query ? `/monitoring?${query}` : '/monitoring');
  }, [view]);

  useEffect(() => {
    const handlePopState = () => {
      const current = new URLSearchParams(window.location.search).get('view');
      const next: AlertsView = current === 'archived' ? 'archived' : 'active';
      setView((previous) => (previous === next ? previous : next));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Source fetch. Each source fails independently so a reports outage still
  // leaves the weather panel usable (and vice versa).
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const reportPages = view === 'archived' ? ARCHIVED_REPORT_PAGES : ACTIVE_REPORT_PAGES;
    const weatherPages = view === 'archived' ? ARCHIVED_WEATHER_PAGES : ACTIVE_WEATHER_PAGES;

    void (async () => {
      const [reportsResult, weatherResult] = await Promise.allSettled([
        fetchReportPages(reportPages),
        fetchWeatherPages(weatherPages),
      ]);
      if (cancelled) return;

      if (reportsResult.status === 'fulfilled') {
        setReports(reportsResult.value);
        setReportsError(null);
      } else {
        setReportsError(
          reportsResult.reason instanceof Error
            ? reportsResult.reason.message
            : 'Unable to load report alerts.'
        );
      }

      if (weatherResult.status === 'fulfilled') {
        setWeatherAlerts(weatherResult.value);
        setWeatherError(null);
      } else {
        setWeatherAlerts([]);
        setWeatherError('Unable to load weather alerts.');
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, view]);

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

  // Keep inbox in sync with changes made on other surfaces (header bell).
  useEffect(
    () =>
      subscribeToReceiptChanges((kind, ids) => {
        if (kind === 'read') {
          setReadIds((cur) => [...new Set([...cur, ...ids])]);
        } else if (kind === 'dismissed') {
          setDismissedIds((cur) => [...new Set([...cur, ...ids])]);
        } else {
          // restored: leave both sets so the item reappears as unread/active.
          setReadIds((cur) => cur.filter((id) => !ids.includes(id)));
          setDismissedIds((cur) => cur.filter((id) => !ids.includes(id)));
        }
      }),
    []
  );

  const markAsRead = useCallback((id: string) => {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]));
    void markNotificationsRead([id]);
  }, []);

  const markManyAsRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setReadIds((current) => [...new Set([...current, ...ids])]);
    void markNotificationsRead(ids);
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissedIds((current) => (current.includes(id) ? current : [...current, id]));
    void dismissNotifications([id]);
  }, []);

  const restore = useCallback((id: string) => {
    setDismissedIds((current) => current.filter((existing) => existing !== id));
    setReadIds((current) => current.filter((existing) => existing !== id));
    void restoreNotifications([id]);
  }, []);

  // Source lists, kept separate so each panel owns its own feed.
  const reportSource = useMemo(() => reportNotifications(reports), [reports]);
  const weatherSource = useMemo(() => weatherNotifications(weatherAlerts), [weatherAlerts]);

  // Every notification the modal can target, archived or not.
  const allNotifications = useMemo(
    () => [...reportSource, ...weatherSource],
    [reportSource, weatherSource]
  );

  // Archive partition drives which segment each panel feeds. Read receipts
  // don't change often enough to justify memoising on a clock.
  const { active: activeReports, archived: archivedReports } = useMemo(
    () => partitionArchived(reportSource, { dismissedIds, readIds }),
    [dismissedIds, readIds, reportSource]
  );
  const { active: activeWeather, archived: archivedWeather } = useMemo(
    () => partitionArchived(weatherSource, { dismissedIds, readIds }),
    [dismissedIds, readIds, weatherSource]
  );

  const visibleReports = view === 'archived' ? archivedReports : activeReports;
  const visibleWeather = view === 'archived' ? archivedWeather : activeWeather;

  const unreadIds = useMemo(() => {
    const readSet = new Set(readIds);
    return [...activeReports, ...activeWeather]
      .filter((n) => !readSet.has(n.id))
      .map((n) => n.id);
  }, [activeReports, activeWeather, readIds]);

  const dismissTarget = dismissConfirmId
    ? allNotifications.find((n) => n.id === dismissConfirmId) ?? null
    : null;

  useEffect(() => {
    if (!dismissConfirmId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDismissConfirmId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismissConfirmId]);

  const unreadCount = unreadIds.length;
  const totalCount = activeReports.length + activeWeather.length;

  const sharedPanelProps = {
    view,
    loading,
    highlightedId: activeHighlightedId,
    readIds,
    onMarkRead: markAsRead,
    onDismiss: dismiss,
    onRestore: restore,
    onDismissRequest: setDismissConfirmId,
    onOpenReports,
    onMarkAllRead: markManyAsRead,
  };

  return (
    <section className="flex min-h-0 flex-col gap-3 xl:h-full">
      <div className="rounded-2xl border border-canvas-grey bg-white p-3 shadow-sm shrink-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Notification inbox</h3>
            <p className="mt-1 text-sm text-slate-500" aria-live="polite">
              {loading
                ? 'Loading notifications...'
                : view === 'archived'
                  ? `${visibleReports.length + visibleWeather.length} archived`
                  : `${totalCount} notifications${
                      unreadCount > 0 ? ` · ${unreadCount} unread` : ''
                    }`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {view === 'active' && !loading && unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markManyAsRead(unreadIds)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-grey bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-gakit-maroon hover:text-gakit-maroon"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark all as read
              </button>
            )}

            <div
              role="tablist"
              aria-label="Inbox view"
              className="inline-flex rounded-lg border border-canvas-grey bg-canvas-light p-1"
            >
              {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => {
                const isSelected = view === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setView(value)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                      isSelected
                        ? 'bg-white text-gakit-maroon shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-3 xl:flex-1 xl:grid-cols-2 xl:grid-rows-1">
        <WeatherAlertsPanel
          notifications={visibleWeather}
          error={weatherError}
          onSelectWeatherAlert={onSelectWeatherAlert}
          {...sharedPanelProps}
        />
        <ReportAlertsPanel
          notifications={visibleReports}
          error={reportsError}
          {...sharedPanelProps}
        />
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
