'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, CloudRain, AlertTriangle, Flame, Thermometer, X } from 'lucide-react';
import type { WeatherAlert, AlertSeverity, AlertType, WeatherAlertData } from '@/types/weather';

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { bg: string; text: string; icon: string; dot: string }
> = {
  critical: { bg: 'bg-red-50', text: 'text-red-800', icon: 'text-red-500', dot: 'bg-red-500' },
  warning: { bg: 'bg-orange-50', text: 'text-orange-800', icon: 'text-orange-500', dot: 'bg-orange-500' },
  info: { bg: 'bg-blue-50', text: 'text-blue-800', icon: 'text-blue-500', dot: 'bg-blue-500' },
};

const ALERT_ICONS: Record<AlertType, typeof CloudRain> = {
  thunderstorm: AlertTriangle,
  heavy_rain: CloudRain,
  extreme_heat: Flame,
  daily_digest: Thermometer,
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  thunderstorm: 'Thunderstorm',
  heavy_rain: 'Heavy Rain',
  extreme_heat: 'Heat Advisory',
  daily_digest: 'Daily Forecast',
};

export interface NotificationItem {
  id: string;
  title: string;
  subtitle: string;
  severity: AlertSeverity;
  alertType?: AlertType;
  sentAt: string;
  validFrom?: string;
  validTo?: string;
  data?: WeatherAlertData | null;
}

interface NotificationBellProps {
  notifications: NotificationItem[];
  onSelectAlert?: (alert: WeatherAlert) => void;
  className?: string;
  variant?: 'header' | 'map' | 'mobile-nav';
}

export function NotificationBell({
  notifications,
  onSelectAlert,
  className = '',
  variant = 'header',
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const count = notifications.length;

  const buttonClassName =
    variant === 'header'
      ? `relative rounded-lg border p-2 transition-colors ${
          open
            ? 'border-gakit-maroon bg-maroon-50'
            : 'border-canvas-grey hover:bg-canvas-light'
        }`
      : variant === 'mobile-nav'
        ? `relative flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
            open ? 'bg-maroon-50 text-gakit-maroon' : 'text-slate-500 hover:bg-maroon-50 hover:text-gakit-maroon'
          }`
        : 'relative flex items-center gap-2 rounded-xl bg-white/90 px-3 py-3 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur-none transition-shadow duration-200 hover:shadow-2xl md:backdrop-blur';

  const iconClassName =
    variant === 'mobile-nav' ? 'h-5 w-5' : 'h-5 w-5';

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={buttonClassName}
        title={`${count} notification${count !== 1 ? 's' : ''}`}
        aria-label="Notifications"
      >
        <Bell className={`${iconClassName} ${variant === 'header' ? 'text-slate-600' : 'text-gakit-maroon'}`} />
        {count > 0 && (
          <span
            className={`absolute flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ${
              variant === 'header'
                ? '-right-1 -top-1'
                : variant === 'mobile-nav'
                  ? '-right-0.5 -top-0.5'
                  : '-top-1.5 -right-1.5 h-5 min-w-[20px]'
            }`}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
        {variant === 'mobile-nav' && (
          <span className="text-[10px] font-semibold">Alerts</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`z-[1300] overflow-hidden rounded-xl border border-canvas-grey bg-white shadow-xl ${
            variant === 'header'
              ? 'absolute right-0 top-auto mt-2 w-80'
              : variant === 'mobile-nav'
                ? 'fixed inset-x-4 bottom-24 w-auto md:hidden'
                : 'absolute right-0 top-full mt-2 w-80'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-canvas-grey px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <p className="text-xs text-slate-500">
                {count > 0 ? `${count} active alert${count !== 1 ? 's' : ''}` : 'No alerts'}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-canvas-light hover:text-slate-700 transition-colors"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* List */}
          {count === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No notifications
            </div>
          ) : (
            <div className="max-h-80 divide-y divide-canvas-grey overflow-y-auto">
              {notifications.map((item) => {
                const config = SEVERITY_CONFIG[item.severity];
                const Icon = item.alertType ? (ALERT_ICONS[item.alertType] ?? CloudRain) : Bell;
                const typeLabel = item.alertType ? ALERT_TYPE_LABELS[item.alertType] : '';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (onSelectAlert) {
                        onSelectAlert({
                          id: item.id.replace('weather-', ''),
                          alertType: (item.alertType ?? 'daily_digest') as AlertType,
                          severity: item.severity,
                          title: item.title,
                          description: item.subtitle,
                          validFrom: item.validFrom ?? item.sentAt,
                          validTo: item.validTo ?? item.sentAt,
                          createdAt: item.sentAt,
                          data: item.data ?? null,
                        });
                      }
                      setOpen(false);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas-light"
                  >
                    <span className={`rounded-lg p-2 ${config.bg}`}>
                      <Icon className={`h-4 w-4 ${config.icon}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 line-clamp-1">
                          {item.title}
                        </span>
                        {typeLabel && (
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${config.bg} ${config.text}`}>
                            {typeLabel}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {item.subtitle}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${config.dot}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
