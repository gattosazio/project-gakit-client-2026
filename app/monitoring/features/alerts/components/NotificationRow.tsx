import { memo } from 'react';
import { CheckCircle2, Eye, XCircle } from 'lucide-react';
import { DEPTH_LABELS, formatDateTime } from '@/lib/reports/reportFormatting';
import type { Notification } from '@/lib/notifications';
import type { WeatherAlert as WeatherAlertType } from '@/types/weather';
import { NotificationTypeBadge, SeverityBadge } from './AlertBadges';

interface NotificationRowProps {
  notification: Notification;
  onOpenReports: (reportId?: string) => void;
  onSelectWeatherAlert?: (alert: WeatherAlertType) => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  isRead: boolean;
  highlighted: boolean;
}

export const NotificationRow = memo(function NotificationRow({
  notification,
  onOpenReports,
  onSelectWeatherAlert,
  onMarkRead,
  onDismiss,
  isRead,
  highlighted,
}: NotificationRowProps) {
  const handleView = () => {
    if (!isRead) onMarkRead(notification.id);
    if (notification.type === 'weather' && onSelectWeatherAlert && notification.weatherAlert) {
      onSelectWeatherAlert(notification.weatherAlert);
    } else {
      onOpenReports(notification.reportId);
    }
  };

  return (
    <tr
      data-highlighted-notification={highlighted ? notification.id : undefined}
      className={`${highlighted ? 'bg-maroon-100/80' : 'hover:bg-canvas-light/60'} transition-colors duration-200`}
    >
      <td className="px-6 py-4">
        <NotificationTypeBadge type={notification.type} />
      </td>
      <td
        className={`max-w-56 truncate px-6 py-4 ${
          isRead ? 'text-slate-400' : 'text-slate-700'
        }`}
      >
        {notification.location}
      </td>
      <td className="px-6 py-4">
        <SeverityBadge severity={notification.severity} />
      </td>
      <td className="px-6 py-4 text-slate-600">
        {notification.depth ? DEPTH_LABELS[notification.depth] : '—'}
      </td>
      <td className="whitespace-nowrap px-6 py-4 text-slate-600">
        {formatDateTime(notification.sentAt)}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`View ${notification.title}`}
            onClick={handleView}
            className="inline-flex rounded-lg border border-canvas-grey p-2 text-slate-600 hover:border-gakit-maroon hover:text-gakit-maroon"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </button>
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
      </td>
    </tr>
  );
});
