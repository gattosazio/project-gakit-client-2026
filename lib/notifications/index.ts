// Pure mapping logic that turns domain objects (reports, weather alerts) into
// the unified notification model shown in the monitoring alerts tab. Kept free
// of React so it can be unit-tested directly.
import type { FloodDepthCode, Report } from '@/types/report';
import type { WeatherAlert } from '@/types/weather';
import { alertTitle } from '@/lib/weather/weatherCodes';

export type NotificationType =
  | 'new-report'
  | 'needs-review'
  | 'flagged'
  | 'rejected'
  | 'weather';
export type Severity = 'critical' | 'warning' | 'info' | 'high' | 'medium' | 'low';

export interface Notification {
  id: string;
  type: NotificationType;
  severity: Severity;
  title: string;
  location: string;
  depth?: FloodDepthCode;
  sentAt: string;
  reportId?: string;
  weatherAlert?: WeatherAlert;
}

export function createNotifications(reports: Report[]): Notification[] {
  return reports.flatMap<Notification>((report) => {
    const location = report.location.address || 'Unknown location';

    if (report.status === 'ANOMALY') {
      return [{
        id: `flagged-${report.id}`,
        type: 'flagged',
        severity: 'high',
        title: 'Report flagged for review',
        location,
        depth: report.depth.code,
        sentAt: report.updatedAt,
        reportId: report.id,
      }];
    }

    if (report.status === 'REJECTED') {
      return [{
        id: `rejected-${report.id}`,
        type: 'rejected',
        severity: 'low',
        title: 'Report was rejected',
        location,
        depth: report.depth.code,
        sentAt: report.updatedAt,
        reportId: report.id,
      }];
    }

    if (
      report.status === 'UNVERIFIED' &&
      (report.depth.code === 'head' || report.depth.code === 'overhead')
    ) {
      return [{
        id: `review-${report.id}`,
        type: 'needs-review',
        severity: 'critical',
        title: 'Critical report requires staff review',
        location,
        depth: report.depth.code,
        sentAt: report.createdAt,
        reportId: report.id,
      }];
    }

    if (report.status === 'UNVERIFIED') {
      return [{
        id: `new-${report.id}`,
        type: 'new-report',
        severity: 'medium',
        title: 'A user submitted a report',
        location,
        depth: report.depth.code,
        sentAt: report.createdAt,
        reportId: report.id,
      }];
    }

    return [];
  });
}

export function mapWeatherAlertToNotification(alert: WeatherAlert): Notification {
  return {
    id: `weather-${alert.id}`,
    type: 'weather',
    severity: alert.severity as Severity,
    title: alertTitle(alert),
    location: 'Iligan City',
    sentAt: alert.createdAt,
    weatherAlert: alert,
  };
}
