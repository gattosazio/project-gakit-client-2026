import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_AFTER_DAYS,
  buildNotifications,
  filterByDateRange,
  filterByDepth,
  filterBySeverity,
  filterByType,
  filterReportsByType,
  filterWeatherByAlertType,
  isArchived,
  partitionArchived,
  partitionUnreadRead,
  reportNotifications,
  sectionForNotificationId,
  sectionOf,
  sortNotifications,
  weatherNotifications,
} from '@/lib/notifications/filters';
import { type Notification } from '@/lib/notifications';
import type { Report } from '@/types/report';
import type { WeatherAlert } from '@/types/weather';

const NOW = new Date('2026-08-22T12:00:00Z');
const HOURS_25_AGO = '2026-08-21T11:00:00Z'; // 25h before NOW
const HOURS_6_AGO = '2026-08-22T06:00:00Z'; // 6h before NOW

function makeReport(overrides: Partial<Report> & { id: string }): Report {
  return {
    location: { latitude: 8.22, longitude: 124.26, address: 'Test address' },
    depth: { code: 'knee', label: 'Knee deep', approximateCm: 45 },
    status: 'UNVERIFIED',
    observedAt: HOURS_6_AGO,
    createdAt: HOURS_6_AGO,
    updatedAt: HOURS_6_AGO,
    ...overrides,
  };
}

function makeNotification(overrides: Partial<Notification> & { id: string }): Notification {
  return {
    type: 'new-report',
    severity: 'medium',
    title: 'A user submitted a report',
    location: 'Test address',
    sentAt: HOURS_6_AGO,
    ...overrides,
  };
}

function makeAlert(overrides: Partial<WeatherAlert> & { id: string }): WeatherAlert {
  return {
    alertType: 'heavy_rain',
    severity: 'warning',
    validFrom: '2026-08-22T00:00:00Z',
    validTo: '2026-08-22T12:00:00Z',
    createdAt: HOURS_6_AGO,
    ...overrides,
  } as WeatherAlert;
}

describe('sectionForNotificationId', () => {
  it('routes weather-prefixed ids to the weather panel', () => {
    expect(sectionForNotificationId('weather-w1')).toBe('weather');
  });

  it('routes every report id prefix to the report panel', () => {
    expect(sectionForNotificationId('flagged-r1')).toBe('report');
    expect(sectionForNotificationId('rejected-r2')).toBe('report');
    expect(sectionForNotificationId('review-r3')).toBe('report');
    expect(sectionForNotificationId('new-r4')).toBe('report');
  });

  it('defaults unknown ids to the report panel', () => {
    expect(sectionForNotificationId('something-else')).toBe('report');
  });
});

describe('sectionOf', () => {
  it('assigns by notification type, matching the id prefix rule', () => {
    const weather = makeNotification({ id: 'weather-w1', type: 'weather' });
    const report = makeNotification({ id: 'flagged-r1', type: 'flagged' });

    expect(sectionOf(weather)).toBe('weather');
    expect(sectionOf(report)).toBe('report');
    // The two routing strategies must agree, otherwise a highlighted row could
    // land in the panel that doesn't render it.
    expect(sectionForNotificationId(weather.id)).toBe(sectionOf(weather));
    expect(sectionForNotificationId(report.id)).toBe(sectionOf(report));
  });
});

describe('filterByDateRange', () => {
  const items = [
    makeNotification({ id: 'fresh', sentAt: HOURS_6_AGO }),
    makeNotification({ id: 'stale', sentAt: HOURS_25_AGO }),
  ];

  it('keeps only the last 24 hours for 24h', () => {
    expect(filterByDateRange(items, '24h', NOW).map((n) => n.id)).toEqual(['fresh']);
  });

  it('keeps both items for 7d', () => {
    expect(filterByDateRange(items, '7d', NOW).map((n) => n.id)).toEqual(['fresh', 'stale']);
  });

  it('keeps everything for all', () => {
    expect(filterByDateRange(items, 'all', NOW).map((n) => n.id)).toEqual(['fresh', 'stale']);
  });

  it('treats the boundary as inclusive', () => {
    const atBoundary = makeNotification({
      id: 'boundary',
      sentAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(filterByDateRange([atBoundary], '24h', NOW)).toHaveLength(1);
  });

  it('does not mutate the input array', () => {
    const input = [...items];
    filterByDateRange(input, '24h', NOW);
    expect(input).toHaveLength(2);
  });
});

describe('filterByType', () => {
  const items = [
    makeNotification({ id: 'a', type: 'flagged' }),
    makeNotification({ id: 'b', type: 'weather' }),
    makeNotification({ id: 'c', type: 'needs-review' }),
  ];

  it('returns everything for all', () => {
    expect(filterByType(items, 'all')).toHaveLength(3);
  });

  it('keeps only the requested type', () => {
    expect(filterByType(items, 'weather').map((n) => n.id)).toEqual(['b']);
    expect(filterByType(items, 'flagged').map((n) => n.id)).toEqual(['a']);
  });
});

describe('sortNotifications', () => {
  it('sorts sentAt descending by default direction passed in', () => {
    const items = [
      makeNotification({ id: 'old', sentAt: HOURS_25_AGO }),
      makeNotification({ id: 'new', sentAt: HOURS_6_AGO }),
    ];
    expect(sortNotifications(items, 'sentAt', 'desc').map((n) => n.id)).toEqual(['new', 'old']);
    expect(sortNotifications(items, 'sentAt', 'asc').map((n) => n.id)).toEqual(['old', 'new']);
  });

  it('sorts severity by rank, not alphabetically, so critical surfaces first', () => {
    // Alphabetically 'critical' < 'info' < 'warning', which would bury
    // critical when sorting descending.
    const items = [
      makeNotification({ id: 'info', severity: 'info', type: 'weather' }),
      makeNotification({ id: 'warning', severity: 'warning', type: 'weather' }),
      makeNotification({ id: 'critical', severity: 'critical', type: 'weather' }),
    ];
    expect(sortNotifications(items, 'severity', 'desc').map((n) => n.id)).toEqual([
      'critical',
      'warning',
      'info',
    ]);
    expect(sortNotifications(items, 'severity', 'asc').map((n) => n.id)).toEqual([
      'info',
      'warning',
      'critical',
    ]);
  });

  it('orders the report severity vocabulary correctly', () => {
    const items = [
      makeNotification({ id: 'low', severity: 'low' }),
      makeNotification({ id: 'medium', severity: 'medium' }),
      makeNotification({ id: 'high', severity: 'high' }),
      makeNotification({ id: 'critical', severity: 'critical' }),
    ];
    expect(sortNotifications(items, 'severity', 'desc').map((n) => n.id)).toEqual([
      'critical',
      'high',
      'medium',
      'low',
    ]);
  });

  it('orders depth by its display label', () => {
    const items = [
      makeNotification({ id: 'ankle', depth: 'ankle' }),
      makeNotification({ id: 'head', depth: 'head' }),
      makeNotification({ id: 'nodepth' }),
    ];
    expect(sortNotifications(items, 'depth', 'asc').map((n) => n.id)).toEqual([
      'nodepth',
      'ankle',
      'head',
    ]);
  });

  it('does not mutate the input array', () => {
    const items = [
      makeNotification({ id: 'old', sentAt: HOURS_25_AGO }),
      makeNotification({ id: 'new', sentAt: HOURS_6_AGO }),
    ];
    sortNotifications(items, 'sentAt', 'asc');
    expect(items.map((n) => n.id)).toEqual(['old', 'new']);
  });
});

describe('partitionUnreadRead', () => {
  it('splits by read ids without losing or duplicating items', () => {
    const items = [
      makeNotification({ id: 'a' }),
      makeNotification({ id: 'b' }),
      makeNotification({ id: 'c' }),
    ];
    const { unread, read } = partitionUnreadRead(items, ['b']);

    expect(unread.map((n) => n.id)).toEqual(['a', 'c']);
    expect(read.map((n) => n.id)).toEqual(['b']);
    expect(unread.length + read.length).toBe(items.length);
  });
});

describe('isArchived', () => {
  const dismissed = makeNotification({ id: 'dismissed' });
  const readRecent = makeNotification({ id: 'read-recent', sentAt: HOURS_6_AGO });
  const readOld = makeNotification({
    id: 'read-old',
    sentAt: new Date(NOW.getTime() - (ARCHIVE_AFTER_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString(),
  });
  const unreadOld = makeNotification({
    id: 'unread-old',
    sentAt: new Date(NOW.getTime() - (ARCHIVE_AFTER_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString(),
  });

  it('archives anything the user dismissed, regardless of age or read state', () => {
    expect(isArchived(dismissed, { dismissedIds: ['dismissed'], readIds: [] }, NOW)).toBe(true);
  });

  it('auto-archives a notification read for at least ARCHIVE_AFTER_DAYS', () => {
    expect(isArchived(readOld, { dismissedIds: [], readIds: ['read-old'] }, NOW)).toBe(true);
  });

  it('keeps a recently read notification active', () => {
    expect(isArchived(readRecent, { dismissedIds: [], readIds: ['read-recent'] }, NOW)).toBe(false);
  });

  it('never auto-archives an unread notification, however old', () => {
    expect(isArchived(unreadOld, { dismissedIds: [], readIds: [] }, NOW)).toBe(false);
  });

  it('treats the age boundary as inclusive', () => {
    const atBoundary = makeNotification({
      id: 'boundary',
      sentAt: new Date(NOW.getTime() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(isArchived(atBoundary, { dismissedIds: [], readIds: ['boundary'] }, NOW)).toBe(true);
  });
});

describe('partitionArchived', () => {
  it('routes each notification to exactly one bucket', () => {
    const items = [
      makeNotification({ id: 'dismissed' }),
      makeNotification({
        id: 'read-old',
        sentAt: new Date(NOW.getTime() - (ARCHIVE_AFTER_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString(),
      }),
      makeNotification({ id: 'fresh' }),
    ];
    const { active, archived } = partitionArchived(
      items,
      { dismissedIds: ['dismissed'], readIds: ['read-old'] },
      NOW
    );

    expect(active.map((n) => n.id)).toEqual(['fresh']);
    expect(archived.map((n) => n.id)).toEqual(['dismissed', 'read-old']);
    expect(active.length + archived.length).toBe(items.length);
  });
});

describe('weatherNotifications', () => {
  it('excludes daily digests', () => {
    const result = weatherNotifications([
      makeAlert({ id: 'w1', alertType: 'heavy_rain' }),
      makeAlert({ id: 'w2', alertType: 'daily_digest' }),
      makeAlert({ id: 'w3', alertType: 'thunderstorm' }),
    ]);

    expect(result.map((n) => n.id)).toEqual(['weather-w1', 'weather-w3']);
  });

  it('preserves alert order', () => {
    const result = weatherNotifications([
      makeAlert({ id: 'w1' }),
      makeAlert({ id: 'w2' }),
    ]);
    expect(result.map((n) => n.id)).toEqual(['weather-w1', 'weather-w2']);
  });
});

describe('buildNotifications', () => {
  it('concatenates report and weather notifications', () => {
    const reports = [
      makeReport({ id: 'r1', depth: { code: 'head', label: 'Head', approximateCm: 150 } }),
    ];
    const alerts = [makeAlert({ id: 'w1' })];

    const combined = buildNotifications(reports, alerts);

    expect(combined.map((n) => n.id)).toEqual(['review-r1', 'weather-w1']);
    // Every id routes to a panel that can render it.
    expect(
      combined.every((n) => ['weather', 'report'].includes(sectionForNotificationId(n.id)))
    ).toBe(true);
  });

  it('agrees with the per-source builders the two panels use', () => {
    const reports = [makeReport({ id: 'r1', status: 'ANOMALY' })];
    const alerts = [makeAlert({ id: 'w1' })];

    expect(buildNotifications(reports, alerts)).toEqual([
      ...reportNotifications(reports),
      ...weatherNotifications(alerts),
    ]);
  });
});

describe('filterReportsByType', () => {
  const items = [
    makeNotification({ id: 'a', type: 'flagged' }),
    makeNotification({ id: 'b', type: 'needs-review' }),
    makeNotification({ id: 'c', type: 'rejected' }),
    makeNotification({ id: 'w', type: 'weather' }),
  ];

  it('keeps the report categories only', () => {
    expect(filterReportsByType(items, 'flagged').map((n) => n.id)).toEqual(['a']);
    expect(filterReportsByType(items, 'needs-review').map((n) => n.id)).toEqual(['b']);
    expect(filterReportsByType(items, 'rejected').map((n) => n.id)).toEqual(['c']);
  });

  it('returns everything for all, including weather rows', () => {
    expect(filterReportsByType(items, 'all')).toHaveLength(4);
  });
});

describe('filterWeatherByAlertType', () => {
  const items = [
    makeNotification({ id: 't', type: 'weather', weatherAlert: makeAlert({ id: 't', alertType: 'thunderstorm' }) }),
    makeNotification({ id: 'r', type: 'weather', weatherAlert: makeAlert({ id: 'r', alertType: 'heavy_rain' }) }),
    makeNotification({ id: 'h', type: 'weather', weatherAlert: makeAlert({ id: 'h', alertType: 'extreme_heat' }) }),
    makeNotification({ id: 'rep', type: 'flagged' }),
  ];

  it('selects a single advisory type', () => {
    expect(filterWeatherByAlertType(items, 'thunderstorm').map((n) => n.id)).toEqual(['t']);
    expect(filterWeatherByAlertType(items, 'heavy_rain').map((n) => n.id)).toEqual(['r']);
    expect(filterWeatherByAlertType(items, 'extreme_heat').map((n) => n.id)).toEqual(['h']);
  });

  it('returns everything for all', () => {
    expect(filterWeatherByAlertType(items, 'all')).toHaveLength(4);
  });

  it('never matches report rows', () => {
    expect(filterWeatherByAlertType([items[3]], 'heavy_rain')).toEqual([]);
  });
});

describe('filterBySeverity', () => {
  const items = [
    makeNotification({ id: 'c', severity: 'critical' }),
    makeNotification({ id: 'w', severity: 'warning', type: 'weather' }),
    makeNotification({ id: 'i', severity: 'info', type: 'weather' }),
  ];

  it('selects one severity across both vocabularies', () => {
    expect(filterBySeverity(items, 'critical').map((n) => n.id)).toEqual(['c']);
    expect(filterBySeverity(items, 'warning').map((n) => n.id)).toEqual(['w']);
    expect(filterBySeverity(items, 'info').map((n) => n.id)).toEqual(['i']);
  });

  it('returns everything for all', () => {
    expect(filterBySeverity(items, 'all')).toHaveLength(3);
  });
});

describe('filterByDepth', () => {
  const items = [
    makeNotification({ id: 'shallow', depth: 'knee' }),
    makeNotification({ id: 'deep', depth: 'head' }),
    makeNotification({ id: 'none' }),
    makeNotification({ id: 'weather', type: 'weather' }),
  ];

  it('keeps only the requested depth', () => {
    expect(filterByDepth(items, 'head').map((n) => n.id)).toEqual(['deep']);
    expect(filterByDepth(items, 'knee').map((n) => n.id)).toEqual(['shallow']);
  });

  it('excludes rows without a depth (weather rows)', () => {
    expect(filterByDepth(items, 'head').map((n) => n.id)).not.toContain('weather');
  });

  it('returns everything for all', () => {
    expect(filterByDepth(items, 'all')).toHaveLength(4);
  });
});
