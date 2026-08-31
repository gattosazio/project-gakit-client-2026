import { memo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { DEPTH_LABELS, formatDateTime } from '@/lib/reports/reportFormatting';
import type { Notification } from '@/lib/notifications';
import type { WeatherAlert as WeatherAlertType } from '@/types/weather';
import { NotificationTypeBadge, SeverityBadge } from './AlertBadges';

interface NotificationCardProps {
  notification: Notification;
  onOpenReports: (reportId?: string) => void;
  onSelectWeatherAlert?: (alert: WeatherAlertType) => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  isRead: boolean;
  highlighted: boolean;
}

export const NotificationCard = memo(function NotificationCard({
  notification,
  onOpenReports,
  onSelectWeatherAlert,
  onMarkRead,
  onDismiss,
  isRead,
  highlighted,
}: NotificationCardProps) {
  const handleView = () => {
    if (!isRead) onMarkRead(notification.id);
    if (notification.type === 'weather' && onSelectWeatherAlert && notification.weatherAlert) {
      onSelectWeatherAlert(notification.weatherAlert);
    } else {
      onOpenReports(notification.reportId);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-highlighted-notification={highlighted ? notification.id : undefined}
      onClick={handleView}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleView();
        }
      }}
      className={`flex cursor-pointer gap-3 p-4 active:bg-canvas-light ${
        highlighted ? 'bg-maroon-100/80' : ''
      } transition-colors duration-200`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <NotificationTypeBadge type={notification.type} />
          <SeverityBadge severity={notification.severity} />
        </div>
        <p
          className={`mt-3 font-semibold ${
            isRead ? 'text-slate-500' : 'text-slate-900'
          }`}
        >
          {notification.title}
        </p>
        <p className="mt-1 truncate text-sm text-slate-600">{notification.location}</p>
        <p className="mt-2 text-xs text-slate-400">
          {notification.depth ? `${DEPTH_LABELS[notification.depth]} · ` : ''}
          {formatDateTime(notification.sentAt)}
        </p>
      </div>
      <div
        className="flex shrink-0 items-start gap-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {!isRead && (
          <button
            type="button"
            aria-label={`Mark ${notification.title} as read`}
            onClick={() => onMarkRead(notification.id)}
            className="inline-flex rounded-lg border border-canvas-grey p-2 text-slate-600 hover:border-gakit-maroon hover:text-gakit-maroon"
            title="Mark as read"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          aria-label={`Dismiss ${notification.title}`}
          onClick={() => onDismiss(notification.id)}
          className="inline-flex rounded-lg border border-canvas-grey p-2 text-red-600 hover:border-red-200 hover:bg-red-50"
          title="Dismiss"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});
