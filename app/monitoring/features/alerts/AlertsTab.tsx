'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useVisibleInterval } from '@/hooks/useVisibleInterval';
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
import type { Report, ReportStatus } from '@/types/report';
import type { DecisionReason } from '@/lib/reports/decisionReasons';
import { getReport, updateReportStatus } from '../reports/actions/reports';
import { ReportDetail } from '../reports/ReportDetail';
import { toast } from 'react-toastify';
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
  onUnreadCountChange,
}: {
  active?: boolean;
  highlightedNotificationId?: string | null;
  onOpenReports: (reportId?: string) => void;
  onSelectWeatherAlert?: (alert: WeatherAlertType) => void;
  onUnreadCountChange?: (count: number) => void;
}) {
  const searchParams = useSearchParams();
  const notificationParam = highlightedNotificationId ?? searchParams.get('notification');
  const [activeHighlightedId, setActiveHighlightedId] = useState<string | null>(notificationParam);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [updatingReport, setUpdatingReport] = useState(false);
  const [feedVersion, setFeedVersion] = useState(0);
  useVisibleInterval(() => setFeedVersion(version => version + 1), 60_000);
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

  useEffect(() => {
    setActiveHighlightedId(notificationParam);
  }, [notificationParam]);

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


  useEffect(() => {
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
  }, [active, view, feedVersion]);

  useEffect(() => {
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

  const reportSource = useMemo(() => reportNotifications(reports), [reports]);
  const weatherSource = useMemo(() => weatherNotifications(weatherAlerts), [weatherAlerts]);

  const allNotifications = useMemo(
    () => [...reportSource, ...weatherSource],
    [reportSource, weatherSource]
  );


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
  useEffect(() => { onUnreadCountChange?.(unreadCount); }, [onUnreadCountChange, unreadCount]);
  const totalCount = activeReports.length + activeWeather.length;

  const openReportDetail = (reportId?: string) => {
    if (!reportId) return;
    const report = reports.find(item => item.id === reportId);
    if (report) { setSelectedReport(report); return; }
    void getReport(reportId).then(setSelectedReport).catch(() => toast.error('Unable to load report details.'));
  };

  const updateSelectedReport = async (report: Report, status: ReportStatus, reason?: DecisionReason) => {
    if (!reason) return false;
    setUpdatingReport(true);
    try {
      const updated = await updateReportStatus(report.id, status, { reasonCode: reason.reasonCode, reason: reason.note });
      setReports(current => current.map(item => item.id === updated.id ? updated : item));
      setSelectedReport(null);
      toast.success('Report status updated.');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update report.');
      return false;
    } finally { setUpdatingReport(false); }
  };

  const sharedPanelProps = {
    view,
    loading,
    highlightedId: activeHighlightedId,
    readIds,
    onMarkRead: markAsRead,
    onDismiss: dismiss,
    onRestore: restore,
    onDismissRequest: setDismissConfirmId,
    onOpenReports: openReportDetail,
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
        <ReportAlertsPanel
          notifications={visibleReports}
          error={reportsError}
          {...sharedPanelProps}
        />
        <WeatherAlertsPanel
          notifications={visibleWeather}
          error={weatherError}
          onSelectWeatherAlert={onSelectWeatherAlert}
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
      {selectedReport && <ReportDetail key={selectedReport.id} report={selectedReport} modal
        isUpdating={updatingReport} onClose={() => setSelectedReport(null)} onUpdateStatus={updateSelectedReport}
        onViewOnMap={() => { const id = selectedReport.id; setSelectedReport(null); onOpenReports(id); }} />}
    </section>
  );
}
