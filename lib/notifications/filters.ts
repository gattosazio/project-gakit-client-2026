// Pure filtering, sorting, and partitioning helpers shared by the monitoring
// alerts inbox. Kept free of React so it can be unit-tested directly, matching
// the convention already used by lib/notifications/index.ts.
//
// These are a 1:1 extraction of the inline logic that previously lived inside
// AlertsTab.tsx, plus the archive predicates the Archived view will build on.
import { DEPTH_LABELS } from '@/lib/reports/reportFormatting';
import {
  createNotifications,
  mapWeatherAlertToNotification,
  type Notification,
  type NotificationType,
  type Severity,
} from '@/lib/notifications';
import type { FloodDepthCode, Report } from '@/types/report';
import type { AlertType, WeatherAlert } from '@/types/weather';

/** Which side-by-side panel of the alerts inbox a notification belongs to. */
export type AlertSection = 'weather' | 'report';

/** Which top-level inbox view is showing. */
export type AlertsView = 'active' | 'archived';

/** Relative date ranges offered by the inbox filter bar. */
export type DateRange = '24h' | '7d' | 'all';

/** Columns the inbox can sort by; `depth` is only meaningful for reports. */
export type SortColumn = 'type' | 'location' | 'severity' | 'depth' | 'sentAt';
export type SortDirection = 'asc' | 'desc';

/** 'all' or one of the concrete notification types. */
export type NotificationTypeFilter = 'all' | NotificationType;

/** Report-only type filter: the weather chip lives in the weather panel. */
export type ReportTypeFilter = 'all' | Exclude<NotificationType, 'weather'>;

/** Weather-only alert type filter; digests never reach the inbox. */
export type WeatherAlertTypeFilter = 'all' | Exclude<AlertType, 'daily_digest'>;

/** Read/dismissed receipt state, as loaded from notification_read_receipts. */
export interface ArchiveContext {
  dismissedIds: string[];
  readIds: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A notification that has been read for this long is auto-archived in addition
 * to anything the user explicitly dismissed. Read receipts only store that an
 * item was read, not when, so age is measured from the notification itself.
 */
export const ARCHIVE_AFTER_DAYS = 7;

/**
 * Severity is a union of two vocabularies (weather: info/warning/critical,
 * reports: low/medium/high/critical). Ranks are chosen so each vocabulary
 * orders correctly on its own: critical > warning > info and
 * critical > high > medium > low.
 */
const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  high: 4,
  warning: 3,
  medium: 2,
  info: 1,
  low: 0,
};

/**
 * Route a notification id to its panel. Ids are minted by
 * createNotifications (`flagged-`, `review-`, `new-`, `rejected-`) and by
 * mapWeatherAlertToNotification (`weather-`). This is what decodes the
 * `?notification=` URL param.
 */
export function sectionForNotificationId(id: string): AlertSection {
  return id.startsWith('weather-') ? 'weather' : 'report';
}

/** Panel assignment for an already-loaded notification. */
export function sectionOf(notification: Notification): AlertSection {
  return notification.type === 'weather' ? 'weather' : 'report';
}

/** Keep only the notifications whose `sentAt` falls inside the range. */
export function filterByDateRange<T extends { sentAt: string }>(
  items: readonly T[],
  range: DateRange,
  now: Date = new Date()
): T[] {
  if (range === 'all') return items.slice();

  const cutoff = now.getTime() - (range === '24h' ? DAY_MS : 7 * DAY_MS);
  return items.filter((item) => new Date(item.sentAt).getTime() >= cutoff);
}

/** Keep only the notifications of the selected type ('all' keeps everything). */
export function filterByType<T extends { type: NotificationType }>(
  items: readonly T[],
  type: NotificationTypeFilter
): T[] {
  if (type === 'all') return items.slice();
  return items.filter((item) => item.type === type);
}

/** Report panel: type filter that can never select the weather category. */
export function filterReportsByType(
  items: readonly Notification[],
  type: ReportTypeFilter
): Notification[] {
  return filterByType(items, type);
}

/** Weather panel: filter by the underlying advisory type. */
export function filterWeatherByAlertType(
  items: readonly Notification[],
  type: WeatherAlertTypeFilter
): Notification[] {
  if (type === 'all') return items.slice();
  return items.filter((item) => item.weatherAlert?.alertType === type);
}

/** Weather panel: severity vocabulary is info/warning/critical. */
export function filterBySeverity<T extends { severity: Severity }>(
  items: readonly T[],
  severity: Severity | 'all'
): T[] {
  if (severity === 'all') return items.slice();
  return items.filter((item) => item.severity === severity);
}

/** Report panel: restrict to one flood depth code. */
export function filterByDepth<T extends { depth?: FloodDepthCode }>(
  items: readonly T[],
  depth: FloodDepthCode | 'all'
): T[] {
  if (depth === 'all') return items.slice();
  return items.filter((item) => item.depth === depth);
}

function sortValue(notification: Notification, column: SortColumn): string | number {
  switch (column) {
    case 'depth':
      return notification.depth ? DEPTH_LABELS[notification.depth] : '';
    case 'sentAt':
      return new Date(notification.sentAt).getTime();
    case 'severity':
      return SEVERITY_RANK[notification.severity];
    default:
      return notification[column];
  }
}

/**
 * Return a new array sorted by `column`. Severity sorts by rank rather than
 * alphabetically, so critical always surfaces first regardless of direction
 * vocabulary mixing.
 */
export function sortNotifications<T extends Notification>(
  items: readonly T[],
  column: SortColumn,
  direction: SortDirection
): T[] {
  return [...items].sort((a, b) => {
    const left = sortValue(a, column);
    const right = sortValue(b, column);
    const compared =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));

    return direction === 'asc' ? compared : -compared;
  });
}

/** Split by read state without mutating the input. */
export function partitionUnreadRead<T extends Notification>(
  items: readonly T[],
  readIds: readonly string[]
): { unread: T[]; read: T[] } {
  const readSet = new Set(readIds);
  return {
    unread: items.filter((notification) => !readSet.has(notification.id)),
    read: items.filter((notification) => readSet.has(notification.id)),
  };
}

/**
 * Archived means explicitly dismissed, or read for at least
 * ARCHIVE_AFTER_DAYS. Anything not archived stays in the Active view.
 */
export function isArchived(
  notification: Notification,
  context: ArchiveContext,
  now: Date = new Date()
): boolean {
  if (context.dismissedIds.includes(notification.id)) return true;
  if (!context.readIds.includes(notification.id)) return false;

  return now.getTime() - new Date(notification.sentAt).getTime() >= ARCHIVE_AFTER_DAYS * DAY_MS;
}

/** Split into the Active and Archived views in a single pass. */
export function partitionArchived<T extends Notification>(
  items: readonly T[],
  context: ArchiveContext,
  now: Date = new Date()
): { active: T[]; archived: T[] } {
  const active: T[] = [];
  const archived: T[] = [];

  for (const notification of items) {
    (isArchived(notification, context, now) ? archived : active).push(notification);
  }

  return { active, archived };
}

/**
 * Map alert history to notifications, excluding daily digests — routine
 * forecasts would otherwise drown out actionable advisories.
 */
export function weatherNotifications(alerts: WeatherAlert[]): Notification[] {
  return alerts
    .filter((alert) => alert.alertType !== 'daily_digest')
    .map(mapWeatherAlertToNotification);
}

/**
 * Report panel source. Kept separate from the weather feed so each side-by-side
 * panel can load, filter, and paginate its own list.
 */
export function reportNotifications(reports: Report[]): Notification[] {
  return createNotifications(reports);
}

/** Build the combined inbox feed from both sources. */
export function buildNotifications(
  reports: Report[],
  weatherAlerts: WeatherAlert[]
): Notification[] {
  return [...reportNotifications(reports), ...weatherNotifications(weatherAlerts)];
}
