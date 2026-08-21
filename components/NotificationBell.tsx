'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, CloudRain, AlertTriangle, Flame, Thermometer, X } from 'lucide-react';
import type { WeatherAlert, AlertSeverity, AlertType } from '@/types/weather';

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

export interface NotificationItem {
  id: string;
  title: string;
  subtitle: string;
  severity: AlertSeverity;
  alertType?: AlertType;
  sentAt: string;
  onClick?: () => void;
}

interface NotificationBellProps {
  notifications: NotificationItem[];
  onDismiss?: (id: string) => void;
  className?: string;
}

export function NotificationBell({ notifications, onDismiss, className = '' }: NotificationBellProps) {
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

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-2 rounded-xl bg-white/90 px-3 py-3 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur-none transition-shadow duration-200 hover:shadow-2xl md:backdrop-blur"
        title={`${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gakit-maroon" />
        {notifications.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
            {notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute top-0 right-0 mt-0 w-80 max-h-[70vh] overflow-hidden rounded-xl bg-white/95 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200 backdrop-blur-none md:backdrop-blur z-[1100]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900">Notifications</span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close notifications"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-400">
              No notifications
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[calc(70vh-36px)]">
              {notifications.map((item) => {
                const config = SEVERITY_CONFIG[item.severity];
                const Icon = item.alertType ? (ALERT_ICONS[item.alertType] ?? CloudRain) : Bell;
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 ${config.bg}`}
                    onClick={() => {
                      item.onClick?.();
                      setOpen(false);
                    }}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.icon}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-semibold leading-tight ${config.text} truncate`}>
                        {item.title}
                      </p>
                      <p className={`text-[10px] leading-tight ${config.text} opacity-70 truncate`}>
                        {item.subtitle}
                      </p>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
                    {onDismiss && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismiss(item.id);
                        }}
                        className="mt-0.5 p-0.5 rounded text-slate-300 hover:text-slate-500 transition-colors"
                        aria-label="Dismiss"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
