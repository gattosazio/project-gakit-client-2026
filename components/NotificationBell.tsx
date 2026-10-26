'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, ChevronRight, CloudRain, MapPin, X } from 'lucide-react';
import type { WeatherAlert, AlertSeverity, AlertType, WeatherAlertData } from '@/types/weather';
import { ALERT_ICONS, ALERT_TYPE_LABELS } from '@/lib/weather/alertLabels';

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { bg: string; text: string; icon: string; dot: string }
> = {
  critical: { bg: 'bg-red-50', text: 'text-red-800', icon: 'text-red-500', dot: 'bg-red-500' },
  warning: { bg: 'bg-orange-50', text: 'text-orange-800', icon: 'text-orange-500', dot: 'bg-orange-500' },
  info: { bg: 'bg-blue-50', text: 'text-blue-800', icon: 'text-blue-500', dot: 'bg-blue-500' },
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
  read?: boolean;
}

interface NotificationBellProps {
  notifications: NotificationItem[];
  onSelectAlert?: (alert: WeatherAlert) => void;
  onMarkRead?: (id: string) => void;
  className?: string;
  variant?: 'header' | 'map' | 'mobile-nav' | 'toolbar';
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NotificationBell({
  notifications,
  onSelectAlert,
  onMarkRead,
  className = '',
  variant = 'header',
  isOpen,
  onOpenChange,
}: NotificationBellProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const [tab, setTab] = useState<'unread' | 'read'>('unread');
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === 'function' ? next(open) : next;
      if (isOpen === undefined) {
        setInternalOpen(resolved);
      }
      onOpenChange?.(resolved);
    },
    [isOpen, open, onOpenChange]
  );

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
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
    document.addEventListener('touchstart', handleClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [open, setOpen]);

  const isToolbar = variant === 'toolbar';
  const total = notifications.length;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const count = isToolbar ? total : unreadCount;
  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);
  const activeList = isToolbar ? notifications : tab === 'unread' ? unreadNotifications : readNotifications;

  const buttonClassName =
    isToolbar
      ? `relative flex h-8 items-center justify-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold shadow-sm ${open ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-slate-200/80 bg-white/95 text-slate-600'}`
      : variant === 'header'
      ? `relative flex h-10 min-w-10 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[9px] font-semibold text-slate-600 transition-all duration-150 hover:bg-slate-100 hover:text-slate-900 active:scale-95 md:h-9 md:flex-row md:gap-1.5 md:px-2.5 md:text-[11px] ${
          open
            ? 'bg-slate-200 text-slate-900 ring-1 ring-slate-300/80 font-bold'
            : ''
        }`
      : variant === 'mobile-nav'
        ? `relative flex w-full flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1 transition-all duration-150 active:scale-95 ${
            open
              ? 'bg-slate-200 text-slate-900 font-bold'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100'
          }`
        : 'relative flex items-center gap-2 rounded-xl bg-white/90 px-3 py-3 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200 backdrop-blur-none transition-shadow duration-200 hover:shadow-2xl active:scale-95 md:backdrop-blur';

  const iconClassName =
    variant === 'mobile-nav' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) setTab(unreadCount > 0 ? 'unread' : 'read');
        }}
        className={buttonClassName}
        title={isToolbar ? `${total} active advisories` : `${count} notification${count !== 1 ? 's' : ''}`}
        aria-label={isToolbar ? 'Advisories' : 'Notifications'}
        aria-expanded={open}
      >
        <Bell className={`${iconClassName} ${open ? 'text-slate-900' : variant === 'header' ? 'text-slate-600' : 'text-slate-500'}`} />
        {variant === 'header' && <span>Alerts</span>}
        {isToolbar && <ChevronDown className={`h-3 w-3 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />}
        {count > 0 && (
          <span
            className={isToolbar || variant === 'mobile-nav' ? 'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-xs' : `absolute flex h-4 min-w-4 md:min-w-[18px] items-center justify-center rounded-full bg-red-600 px-0.5 md:px-1 text-[10px] md:text-[11px] font-bold text-white shadow-sm ${
              variant === 'header'
                ? '-right-0.5 -top-0.5 md:-right-1 md:-top-1'
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
          role={isToolbar ? 'region' : undefined}
          aria-label={isToolbar ? 'Advisories' : undefined}
          data-header-dropdown={variant === 'header' || isToolbar || undefined}
          className={`${variant === 'header' || isToolbar ? 'map-header-dropdown' : ''} z-[1300] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-xl ring-1 ring-slate-900/10 ${
            isToolbar
              ? 'fixed inset-x-1.5 top-[var(--map-mobile-controls-top,104px)] mx-auto max-w-96'
              : variant === 'header'
              ? 'fixed inset-x-3.5 top-16 shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2.5 md:w-80 animate-in fade-in zoom-in-95 duration-100'
              : variant === 'mobile-nav'
                ? 'fixed inset-x-4 bottom-20 w-auto md:hidden animate-in fade-in slide-in-from-bottom-2 duration-150'
                : 'absolute right-0 top-full mt-2.5 w-80 shadow-xl'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-slate-900">{isToolbar ? 'Advisories' : 'Alerts'}</p>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                {total} active
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          {total > 0 && !isToolbar && (
            <div className="flex border-b border-slate-100">
              <button
                type="button"
                onClick={() => setTab('unread')}
                aria-pressed={tab === 'unread'}
                className={`flex-1 px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  tab === 'unread'
                    ? 'border-b-2 border-gakit-maroon text-gakit-maroon'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setTab('read')}
                aria-pressed={tab === 'read'}
                className={`flex-1 px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  tab === 'read'
                    ? 'border-b-2 border-gakit-maroon text-gakit-maroon'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Read{readNotifications.length > 0 ? ` (${readNotifications.length})` : ''}
              </button>
            </div>
          )}

          {/* List */}
          {total === 0 ? (
            <div className="px-3 py-5 text-center text-xs text-slate-500">
              {isToolbar ? 'No active advisories' : 'No notifications'}
            </div>
          ) : activeList.length === 0 ? (
            <div className="px-3 py-5 text-center text-xs text-slate-500">
              {tab === 'unread' ? 'No unread notifications' : 'No read notifications'}
            </div>
          ) : (
            <div className="max-h-[min(24rem,55dvh)] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
              {activeList.map((item) => {
                const config = SEVERITY_CONFIG[item.severity];
                const Icon = item.alertType ? (ALERT_ICONS[item.alertType] ?? CloudRain) : Bell;
                const typeLabel = item.alertType ? ALERT_TYPE_LABELS[item.alertType] : '';
                const issuedAt = item.data?.issuedAt || item.sentAt;
                const issued = new Date(issuedAt);
                const timestamp = Number.isNaN(issued.getTime()) ? '' : issued.toLocaleString('en-PH', {
                  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                });
                const areas = item.data?.affectedAreas?.filter(Boolean) ?? [];
                const summary = item.subtitle?.trim() || item.data?.description?.trim();
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (onMarkRead) onMarkRead(item.id);
                      if (onSelectAlert) {
                        onSelectAlert({
                          id: item.id.replace('weather-', ''),
                          alertType: (item.alertType ?? 'daily_digest') as AlertType,
                          severity: item.severity,
                          validFrom: item.validFrom ?? item.sentAt,
                          validTo: item.validTo ?? item.sentAt,
                          createdAt: item.sentAt,
                          data: item.data ?? null,
                        });
                      }
                      setOpen(false);
                    }}
                    className="group flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gakit-maroon"
                  >
                    <span className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${config.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${config.icon}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                        <span className={config.text}>{item.severity}</span>
                        {typeLabel && <span className="truncate text-slate-500">· {typeLabel}</span>}
                        {!item.read && <span className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${config.dot}`} aria-label="Unread" />}
                      </span>
                      <span className="mt-0.5 block text-xs font-semibold leading-4 text-slate-900 line-clamp-2">
                        {item.title}
                      </span>
                      {summary && summary !== item.title && (
                        <span className="mt-0.5 block text-[11px] leading-4 text-slate-600 line-clamp-2">{summary}</span>
                      )}
                      {areas.length > 0 && (
                        <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{areas.join(', ')}</span>
                        </span>
                      )}
                      <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="truncate">{item.data?.source || 'Weather advisory'}</span>
                        <time dateTime={Number.isNaN(issued.getTime()) ? undefined : issuedAt} className="shrink-0">{isToolbar && timestamp ? `Issued ${timestamp} PHT` : timestamp}</time>
                      </span>
                    </span>
                    <ChevronRight className="mt-5 h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-slate-600" />
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
