import { describe, expect, it } from 'vitest';
import {
  createNotifications,
  mapWeatherAlertToNotification,
} from '@/lib/notifications';
import type { Report } from '@/types/report';

function makeReport(overrides: Partial<Report> & { id: string }): Report {
  return {
    location: { latitude: 8.22, longitude: 124.26, address: 'Test address' },
    depth: { code: 'knee', label: 'Knee deep', approximateCm: 45 },
    status: 'UNVERIFIED',
    observedAt: '2026-08-22T01:00:00Z',
    createdAt: '2026-08-22T01:00:00Z',
    updatedAt: '2026-08-22T01:00:00Z',
    ...overrides,
  };
}

describe('createNotifications', () => {
  it('maps an UNVERIFIED shallow report to new-report / medium when includeRoutine is true', () => {
    const [notification] = createNotifications([
      makeReport({ id: 'r1' }),
    ], { includeRoutine: true });

    expect(notification).toMatchObject({
      id: 'new-r1',
      type: 'new-report',
      severity: 'medium',
      location: 'Test address',
      depth: 'knee',
      reportId: 'r1',
    });
  });

  it('filters out routine UNVERIFIED shallow reports by default to prevent alert fatigue', () => {
    const notifications = createNotifications([
      makeReport({ id: 'r1', depth: { code: 'knee', label: 'Knee', approximateCm: 45 } }),
      makeReport({ id: 'r2', depth: { code: 'ankle', label: 'Ankle', approximateCm: 15 } }),
      makeReport({ id: 'r3', depth: { code: 'waist', label: 'Waist', approximateCm: 100 } }),
    ]);

    expect(notifications).toEqual([]);
  });

  it('escalates UNVERIFIED head/overhead/shoulder reports to needs-review', () => {
    const [head] = createNotifications([makeReport({ id: 'r2', depth: { code: 'head', label: 'Head', approximateCm: 150 } })]);
    const [overhead] = createNotifications([makeReport({ id: 'r3', depth: { code: 'overhead', label: 'Overhead', approximateCm: 200 } })]);
    const [shoulder] = createNotifications([makeReport({ id: 'r3b', depth: { code: 'shoulder', label: 'Shoulder', approximateCm: 130 } })]);

    expect(head).toMatchObject({ id: 'review-r2', type: 'needs-review', severity: 'critical' });
    expect(overhead).toMatchObject({ id: 'review-r3', type: 'needs-review', severity: 'critical' });
    expect(shoulder).toMatchObject({ id: 'review-r3b', type: 'needs-review', severity: 'high' });
  });

  it('maps ANOMALY and REJECTED statuses with their own ids and severities', () => {
    const [anomaly] = createNotifications([makeReport({ id: 'r4', status: 'ANOMALY' })]);
    const [rejected] = createNotifications([makeReport({ id: 'r5', status: 'REJECTED' })]);

    expect(anomaly).toMatchObject({ id: 'flagged-r4', type: 'flagged', severity: 'high' });
    expect(rejected).toMatchObject({ id: 'rejected-r5', type: 'rejected', severity: 'low' });
    // Anomaly/rejected use the update timestamp, not creation.
    expect(anomaly.sentAt).toBe('2026-08-22T01:00:00Z');
  });

  it('skips VERIFIED reports entirely', () => {
    const notifications = createNotifications([
      makeReport({ id: 'r6', status: 'VERIFIED' }),
    ]);
    expect(notifications).toEqual([]);
  });

  it('falls back to Unknown location when the address is missing on a critical report', () => {
    const [notification] = createNotifications([
      makeReport({
        id: 'r7',
        depth: { code: 'head', label: 'Head', approximateCm: 150 },
        location: { latitude: 8, longitude: 124, address: null },
      }),
    ]);
    expect(notification.location).toBe('Unknown location');
  });

  it('processes a mixed batch independently in default high-signal mode', () => {
    const notifications = createNotifications([
      makeReport({ id: 'a' }), // shallow knee -> omitted
      makeReport({ id: 'b', status: 'ANOMALY' }), // flagged
      makeReport({ id: 'c', status: 'VERIFIED' }), // verified -> omitted
      makeReport({ id: 'd', depth: { code: 'head', label: 'Head', approximateCm: 150 } }), // critical review
    ]);
    expect(notifications.map((n) => n.id)).toEqual(['flagged-b', 'review-d']);
  });
});

describe('mapWeatherAlertToNotification', () => {
  it('wraps the alert with a weather- prefixed id and Iligan location', () => {
    const alert = {
      id: 'w1',
      alertType: 'severe_weather',
      severity: 'warning',
      data: { title: 'Heavy rainfall expected' },
      validFrom: '2026-08-22T00:00:00Z',
      validTo: '2026-08-22T12:00:00Z',
      createdAt: '2026-08-21T23:00:00Z',
    } as any;

    const notification = mapWeatherAlertToNotification(alert);

    expect(notification).toMatchObject({
      id: 'weather-w1',
      type: 'weather',
      severity: 'warning',
      title: 'Heavy rainfall expected',
      location: 'Iligan City',
      sentAt: '2026-08-21T23:00:00Z',
    });
    expect(notification.weatherAlert).toBe(alert);
  });
});
