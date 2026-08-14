'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CloudRain,
  Settings,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { listReports } from '@/app/monitoring/features/reports/actions/reports';
import { formatDateTime } from '@/lib/reportFormatting';
import type { Report } from '@/types/report';
import { MobileSignOutButton } from './SideBar';

interface AdminHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  onNotificationClick?: (notificationId: string) => void;
}

interface HeaderNotification {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  icon: typeof Bell;
  iconClass: string;
}

const STATIC_NOTIFICATIONS: HeaderNotification[] = [
  {
    id: 'weather-rainfall',
    title: 'Heavy rainfall advisory',
    detail: 'Iligan City',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    icon: CloudRain,
    iconClass: 'bg-cyan-50 text-cyan-700',
  },
];

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
  onNotificationClick,
}: AdminHeaderProps) {
  const [notifications, setNotifications] = useState<HeaderNotification[]>(STATIC_NOTIFICATIONS);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const result = await listReports({ limit: 10 });
      setNotifications([...createNotifications(result.items), ...STATIC_NOTIFICATIONS]);
    } catch {
      setNotifications(STATIC_NOTIFICATIONS);
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem('gakit-read-notifications');
    if (saved) setReadIds(JSON.parse(saved) as string[]);
    void loadNotifications();
  }, [loadNotifications]);

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

  const recentNotifications = useMemo(
    () =>
      [...notifications]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5),
    [notifications]
  );
  const unreadCount = recentNotifications.filter(
    (notification) => !readIds.includes(notification.id)
  ).length;

  const markAsRead = (id: string) => {
    setReadIds((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      window.localStorage.setItem('gakit-read-notifications', JSON.stringify(next));
      return next;
    });
  };

  const markAllAsRead = () => {
    const next = [
      ...new Set([
        ...readIds,
        ...recentNotifications.map((notification) => notification.id),
      ]),
    ];
    setReadIds(next);
    window.localStorage.setItem('gakit-read-notifications', JSON.stringify(next));
  };

  return (
    <header className="flex h-20 shrink-0 items-center justify-between gap-4 border-b border-canvas-grey bg-white px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && <Icon className="h-8 w-8 shrink-0 text-gakit-maroon" />}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-slate-900 md:text-2xl">
            {title}
          </h1>
          <p className="hidden truncate text-sm text-slate-500 md:block">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div ref={notificationRef} className="relative">
          <button
            type="button"
            aria-label="Open notifications"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
            className="relative rounded-lg border border-canvas-grey p-2 transition-colors hover:bg-canvas-light"
          >
            <Bell className="h-5 w-5 text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-hazard-critical px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isOpen && (
            <div className="absolute right-0 z-[1300] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-canvas-grey bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-canvas-grey px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-900">Notifications</p>
                  <p className="text-xs text-slate-500">Recent activity</p>
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
              <div className="max-h-80 divide-y divide-canvas-grey overflow-y-auto">
                {recentNotifications.map((notification) => {
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
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas-light ${
                        isRead ? 'opacity-60' : ''
                      }`}
                    >
                      <span className={`rounded-lg p-2 ${notification.iconClass}`}>
                        <NotificationIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-800">
                          {notification.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
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
                })}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Settings"
          title="Settings"
          className="rounded-lg border border-canvas-grey p-2 text-slate-600 transition-colors hover:bg-canvas-light hover:text-gakit-maroon"
        >
          <Settings className="h-5 w-5" />
        </button>
        <div className="lg:hidden">
          <MobileSignOutButton compact />
        </div>
      </div>
    </header>
  );
}
