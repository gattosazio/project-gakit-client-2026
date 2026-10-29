import { hasEvidenceConflict } from '@/lib/reports/decisionReasons';
// Pure mapping logic that turns domain objects (reports, weather alerts) into
// the unified notification model shown in the monitoring alerts tab. Kept free
// of React so it can be unit-tested directly.
import type { FloodDepthCode, Report, ReportStatus } from '@/types/report';
import type { WeatherAlert } from '@/types/weather';
import { alertTitle } from '@/lib/weather/weatherCodes';
import { isPagasaAlert, normalizeTownName, shortTitle } from '@/lib/weather/pagasa';

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
  reportStatus?: ReportStatus;
  weatherAlert?: WeatherAlert;
}

export interface CreateNotificationsOptions {
  /**
   * When true, also generates notifications for routine shallow unverified reports.
   * Defaults to false so routine submissions do not cause notification fatigue.
   */
  includeRoutine?: boolean;
}

export function createNotifications(
  reports: Report[],
  options: CreateNotificationsOptions = {}
): Notification[] {
  const { includeRoutine = false } = options;

  return reports.flatMap<Notification>((report) => {
    const location = report.location.address || 'Unknown location';

    const historical = report.validationSummary?.missing?.includes('HISTORICAL_OBSERVATION_REVIEW')
      || report.validationFlags?.includes('HISTORICAL_OBSERVATION_REVIEW');
    if (historical && (report.status === 'UNVERIFIED' || report.status === 'ANOMALY')) {
      return [{
        id: `review-${report.id}`, type: 'needs-review', severity: 'low',
        title: 'Historical observation requires review', location,
        depth: report.depth.code, sentAt: report.createdAt, reportId: report.id,
      }];
    }

    if (hasEvidenceConflict(report)) {
      return [{
        id: `flagged-${report.id}`,
        type: 'flagged',
        severity: report.depth.code === 'head' || report.depth.code === 'overhead' ? 'critical' : 'high',
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

    if (report.status === 'UNVERIFIED' && report.depth.code === 'shoulder') {
      return [{
        id: `review-${report.id}`,
        type: 'needs-review',
        severity: 'high',
        title: 'High flood depth requires review',
        location,
        depth: report.depth.code,
        sentAt: report.createdAt,
        reportId: report.id,
      }];
    }

    if (report.status === 'UNVERIFIED' && includeRoutine) {
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
  const affectedAreas = (alert.data?.affectedAreas ?? [])
    .map(area => normalizeTownName(area.replace(/^#/, '').trim()))
    .filter(Boolean);
  return {
    id: `weather-${alert.id}`,
    type: 'weather',
    severity: alert.severity as Severity,
    title: isPagasaAlert(alert) ? shortTitle(alert) || alertTitle(alert) : alertTitle(alert),
    location: alert.data?.coverageLabel || (affectedAreas.length ? affectedAreas.join('; ') : alert.data?.location?.label || 'Area not specified'),
    sentAt: alert.createdAt,
    weatherAlert: alert,
  };
}
