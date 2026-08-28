'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CloudRain,
  AlertTriangle,
  Flame,
  Thermometer,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { listReports } from '@/app/monitoring/features/reports/actions/reports';
import { createClient } from '@/lib/supabase/client';
import {
  dismissNotifications,
  fetchNotificationReceipts,
  markNotificationsRead,
  subscribeToReceiptChanges,
} from '@/lib/notifications/receipts';
import { useActiveAlerts } from '@/lib/weather/weatherStore';
import { formatDateTime } from '@/lib/reports/reportFormatting';
import type { Report } from '@/types/report';
import type { WeatherAlert } from '@/types/weather';
import { MobileSignOutButton } from './SideBar';
import { SettingsDropdown } from './SettingsDropdown';
import type { StaffRole } from '@/lib/auth/roles';

interface AdminHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  role?: StaffRole | null;
  onNotificationClick?: (notificationId: string) => void;
}

interface HeaderNotification {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  icon: typeof Bell;
  iconClass: string;
  badge?: { label: string; className: string };
}

const WEATHER_ICONS: Record<string, typeof CloudRain> = {
  thunderstorm: AlertTriangle,
  heavy_rain: CloudRain,
  extreme_heat: Flame,
  daily_digest: Thermometer,
};

const WEATHER_TYPE_LABELS: Record<string, string> = {
  thunderstorm: 'Thunderstorm',
  heavy_rain: 'Heavy Rain',
  extreme_heat: 'Heat Advisory',
  daily_digest: 'Daily Forecast',
};

const SEVERITY_ICON_CLASS: Record<string, string> = {
  critical: 'bg-red-50 text-red-700',
  warning: 'bg-orange-50 text-orange-700',
  info: 'bg-blue-50 text-blue-700',
};

function mapWeatherToHeader(alert: WeatherAlert): HeaderNotification {
  const severityClass =
    SEVERITY_ICON_CLASS[alert.severity] ?? 'bg-cyan-50 text-cyan-700';
  return {
    id: `weather-${alert.id}`,
    title: alert.title,
    detail: alert.description,
    createdAt: alert.createdAt,
    icon: WEATHER_ICONS[alert.alertType] ?? CloudRain,
    iconClass: severityClass,
    badge: {
      label: WEATHER_TYPE_LABELS[alert.alertType] ?? 'Weather',
      className: severityClass,
    },
  };
}

function createNotifications(reports: Report[]): HeaderNotification[] {
  return reports.flatMap<HeaderNotification>((report) => {
    const detail = report.location.address || 'Unknown location';

    if (report.status === 'ANOMALY') {
      return [{
        id: `flagged-${report.id}`,
        title: 'Report flagged for review',
        detail,
        createdAt: report.updatedAt,
        icon: ShieldAlert,
        iconClass: 'bg-orange-50 text-orange-700',
      }];
    }

    if (
      report.status === 'UNVERIFIED' &&
      (report.depth.code === 'head' || report.depth.code === 'overhead')
    ) {
      return [{
        id: `review-${report.id}`,
        title: 'Critical report requires staff review',
        detail,
        createdAt: report.createdAt,
        icon: Bell,
        iconClass: 'bg-amber-50 text-amber-700',
      }];
    }

    if (report.status === 'UNVERIFIED') {
      return [{
        id: `new-${report.id}`,
        title: 'New report submitted',
        detail,
        createdAt: report.createdAt,
        icon: Bell,
        iconClass: 'bg-blue-50 text-blue-700',
      }];
    }

    return [];
  });
}

export function AdminHeader({
  title,
  description,
  icon: Icon,
  role = null,
  onNotificationClick,
}: AdminHeaderProps) {
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const activeAlerts = useActiveAlerts();

  // Single mirror of read state to localStorage; individual mutations only
  // touch React state and this keeps storage in sync (pure updaters).
  useEffect(() => {
    window.localStorage.setItem('gakit-read-notifications', JSON.stringify(readIds));
  }, [readIds]);

  const notifications = useMemo<HeaderNotification[]>(
    () => [...createNotifications(recentReports), ...(activeAlerts ?? []).map(mapWeatherToHeader)],
    [recentReports, activeAlerts]
  );

  const loadReports = useCallback(async () => {
    try {
      const reportsResult = await listReports({ limit: 10 });
      setRecentReports(reportsResult.items);
    } catch {
      setRecentReports([]);
    }
  }, []);

  useEffect(() => {
    // Seed from localStorage for an instant paint; server sync below is the
    // cross-device source of truth.
    const saved = window.localStorage.getItem('gakit-read-notifications');
    const cachedIds: string[] = saved ? (JSON.parse(saved) as string[]) : [];
    if (cachedIds.length > 0) setReadIds(cachedIds);

    void loadReports();
    const interval = setInterval(loadReports, 5 * 60 * 1000);
    // Pull receipts from Supabase so read/dismissed state follows the
    // account, not just this browser.
    let cancelled = false;
    void (async () => {
      const receipts = await fetchNotificationReceipts();
      if (!receipts || cancelled) return;
      const mergedReads = [...new Set([...cachedIds, ...receipts.readIds])];
      if (!cancelled) {
        setReadIds(mergedReads);
        setDismissedIds(receipts.dismissedIds);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadReports]);

  // Keep read/dismissed state in sync with other surfaces (alerts inbox)
  useEffect(
    () =>
      subscribeToReceiptChanges((kind, ids) => {
        if (kind === 'read') setReadIds((cur) => [...new Set([...cur, ...ids])]);
        else setDismissedIds((cur) => [...new Set([...cur, ...ids])]);
      }),
    []
  );

  useEffect(() => {
    // Live updates: refetch when reports change (new submission or status
    // change). Payloads are ignored; the existing loader is the source of
    // truth. Debounced to coalesce bursts (bulk status updates etc).
    const supabase = createClient();
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('admin-notifications-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => void loadReports(), 1500);
        }
      )
      .subscribe();

    return () => {
      if (debounce) clearTimeout(debounce);
      void supabase.removeChannel(channel);
    };
  }, [loadReports]);

  useEffect(() => {
    if (!isOpen) return;

    const close = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [isOpen]);

  const recentNotifications = useMemo(() => {
    // Only show notifications from the last 24 hours, excluding dismissed ones
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return [...notifications]
      .filter(
        (notification) =>
          !dismissedIds.includes(notification.id) &&
          new Date(notification.createdAt).getTime() >= cutoff
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 5);
  }, [dismissedIds, notifications]);

  const unreadNotifications = useMemo(
    () =>
      recentNotifications.filter(
        (notification) => !readIds.includes(notification.id)
      ),
    [recentNotifications, readIds]
  );
  const readNotifications = useMemo(
    () =>
      recentNotifications.filter((notification) =>
        readIds.includes(notification.id)
      ),
    [recentNotifications, readIds]
  );
  const unreadCount = unreadNotifications.length;

  const renderItem = (notification: HeaderNotification) => {
    const NotificationIcon = notification.icon;
    const isRead = readIds.includes(notification.id);

    return (
      <button
        key={notification.id}
        type="button"
        onClick={() => {
          markAsRead(notification.id);
          setIsOpen(false);
          onNotificationClick?.(notification.id);
        }}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas-light"
      >
        <span className={`rounded-lg p-2 ${notification.iconClass}`}>
          <NotificationIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              className={`text-sm font-semibold line-clamp-1 ${
                isRead ? 'text-slate-500' : 'text-slate-800'
              }`}
            >
              {notification.title}
            </span>
            {notification.badge && (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${notification.badge.className}`}
              >
                {notification.badge.label}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {notification.detail}
          </span>
          <span className="mt-1 block text-xs text-slate-400">
            {formatDateTime(notification.createdAt)}
          </span>
        </span>
        {!isRead && (
          <span className="mt-1.5 h-2 w-2 rounded-full bg-hazard-critical" />
        )}
      </button>
    );
  };

  const markAsRead = (id: string) => {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]));
    void markNotificationsRead([id]);
  };

  const markAllAsRead = () => {
    const freshIds = recentNotifications
      .map((notification) => notification.id)
      .filter((id) => !readIds.includes(id));
    setReadIds((current) => [...new Set([...current, ...freshIds])]);
    void markNotificationsRead(freshIds);
  };

  const dismiss = (id: string) => {
    setDismissedIds((current) =>
      current.includes(id) ? current : [...current, id]
    );
    setIsOpen(false);
    void dismissNotifications([id]);
  };

  return (
    <header className="flex h-24 shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 md:px-9">
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-[-0.02em] text-slate-900 md:text-[1.75rem]">
            {title}
          </h1>
          <p className="mt-1 hidden truncate text-sm text-slate-500 md:block">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div ref={notificationRef} className="relative">
          <button
            type="button"
            aria-label="Open notifications"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
            className={`relative rounded-full p-2.5 ring-1 transition-colors ${
              isOpen
                ? 'bg-maroon-50 ring-gakit-maroon'
                : 'bg-slate-50 ring-slate-200 hover:bg-maroon-50 hover:ring-maroon-200'
            }`}
          >
            <Bell className="h-5 w-5 text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-hazard-critical px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isOpen && (
            <div className="fixed inset-x-4 top-24 z-[1300] w-auto overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-3 md:w-[22rem]">
              <div className="flex items-center justify-between border-b border-canvas-grey px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-900">Notifications</p>
                  <p className="text-xs text-slate-500">Last 24 hours</p>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-xs font-semibold text-gakit-maroon hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {recentNotifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    No notifications in the last 24 hours
                  </p>
                ) : (
                  <>
                    {unreadNotifications.length > 0 && (
                      <section>
                        <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Unread
                        </p>
                        <div className="divide-y divide-canvas-grey">
                          {unreadNotifications.map(renderItem)}
                        </div>
                      </section>
                    )}
                    {readNotifications.length > 0 && (
                      <section className={unreadNotifications.length > 0 ? 'border-t border-canvas-grey' : ''}>
                        <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Read
                        </p>
                        <div className="divide-y divide-canvas-grey">
                          {readNotifications.map(renderItem)}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <SettingsDropdown role={role} />
        <div className="lg:hidden">
          <MobileSignOutButton compact />
        </div>
      </div>
    </header>
  );
}
