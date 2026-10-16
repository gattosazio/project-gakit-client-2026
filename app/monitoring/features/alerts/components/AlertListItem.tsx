import { memo } from 'react';
import { CheckCircle2, Eye, RotateCcw, XCircle } from 'lucide-react';
import { DEPTH_LABELS, formatDateTime } from '@/lib/reports/reportFormatting';
import type { Notification } from '@/lib/notifications';
import type { AlertsView } from '@/lib/notifications/filters';
import type { WeatherAlert as WeatherAlertType } from '@/types/weather';
import { AlertTypeBadge, SeverityBadge } from './AlertBadges';

interface AlertListItemProps {
  notification: Notification;
  view: AlertsView;
  onOpenReports: (reportId?: string) => void;
  onSelectWeatherAlert?: (alert: WeatherAlertType) => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
  isRead: boolean;
  highlighted: boolean;
}

/**
 * Single row/card renderer used at every breakpoint and in both the Active and
 * Archived views. The old table (`NotificationRow`) and mobile card
 * (`NotificationCard`) diverged in what they displayed; this keeps the fields
 * identical everywhere so the two side-by-side panels stay comparable.
 */
export const AlertListItem = memo(function AlertListItem({
  notification,
  view,
  onOpenReports,
  onSelectWeatherAlert,
  onMarkRead,
  onDismiss,
  onRestore,
  isRead,
  highlighted,
}: AlertListItemProps) {
  const isArchivedView = view === 'archived';
  const isWeather = notification.type === 'weather';
  const validTo = notification.weatherAlert?.validTo;

  const handleView = () => {
    if (!isRead && !isArchivedView) onMarkRead(notification.id);
    if (isWeather && onSelectWeatherAlert && notification.weatherAlert) {
      onSelectWeatherAlert(notification.weatherAlert);
    } else {
      onOpenReports(notification.reportId);
    }
  };

  // Weather rows have no depth; show the advisory's validity window instead so
  // neither column carries a column the other can't fill.
  const metaLine = isWeather
    ? validTo
      ? `Valid until ${formatDateTime(validTo)}`
      : formatDateTime(notification.sentAt)
    : `${notification.depth ? DEPTH_LABELS[notification.depth] + ' · ' : ''}${formatDateTime(notification.sentAt)}`;

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
        highlighted ? 'bg-maroon-100/80' : 'hover:bg-canvas-light/60'
      } transition-colors duration-200`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <AlertTypeBadge notification={notification} />
          <SeverityBadge severity={notification.severity} />
          {!isRead && !isArchivedView && (
            <span
              aria-label="Unread"
              className="ml-auto h-2 w-2 shrink-0 rounded-full bg-gakit-maroon"
            />
          )}
        </div>
        <p
          className={`mt-2.5 font-semibold ${isRead ? 'text-slate-500' : 'text-slate-900'}`}
        >
          {notification.title}
        </p>
        <p className="mt-1 truncate text-sm text-slate-600">{notification.location}</p>
        <p className="mt-1.5 text-xs text-slate-400">{metaLine}</p>
      </div>

      <div
        className="flex shrink-0 flex-col items-start gap-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {isArchivedView ? (
          <button
            type="button"
            aria-label={`Restore ${notification.title} to active`}
            onClick={() => onRestore(notification.id)}
            className="inline-flex rounded-lg border border-canvas-grey p-2 text-slate-600 hover:border-gakit-maroon hover:text-gakit-maroon"
            title="Restore to active"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
});
