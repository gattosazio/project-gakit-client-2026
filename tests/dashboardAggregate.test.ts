import { describe, expect, it } from 'vitest';
import {
  buildQueue,
  comparePeriods,
  depthDistribution,
  deepestSpots,
  hourlyBuckets,
  niceTicks,
  queueCounts,
  reportGroup,
  timeAgo,
  topSpots,
} from '@/app/monitoring/features/dashboard/aggregate';
import type { Report } from '@/types/report';

const HOUR = 3_600_000;
const NOW = new Date('2026-09-21T06:00:00+08:00').getTime();

function makeReport(
  partial: Partial<Report> & Pick<Report, 'id'>
): Report {
  return {
    location: { latitude: 8.246, longitude: 124.244, address: 'Pala-o Market' },
    depth: { code: 'ankle', label: 'Ankle Deep', approximateCm: 15 },
    status: 'UNVERIFIED',
    observedAt: '2026-09-21T05:00:00.000Z',
    createdAt: '2026-09-21T05:00:00.000Z',
    updatedAt: '2026-09-21T05:00:00.000Z',
    ...partial,
  };
}

describe('reportGroup', () => {
  it('ranks unverified head/overhead depth as critical', () => {
    expect(reportGroup(makeReport({ id: 'a', depth: { code: 'head', label: 'Head Deep', approximateCm: 160 } }))).toBe('critical');
    expect(reportGroup(makeReport({ id: 'b', depth: { code: 'overhead', label: 'Overhead', approximateCm: 210 } }))).toBe('critical');
  });

  it('flags anomalies regardless of depth', () => {
    expect(reportGroup(makeReport({ id: 'c', status: 'ANOMALY' }))).toBe('flagged');
  });

  it('treats shallow unverified reports as pending', () => {
    expect(reportGroup(makeReport({ id: 'd', depth: { code: 'knee', label: 'Knee Deep', approximateCm: 45 } }))).toBe('pending');
  });

  it('excludes verified and rejected reports from the queue', () => {
    expect(reportGroup(makeReport({ id: 'e', status: 'VERIFIED' }))).toBe('done');
    expect(reportGroup(makeReport({ id: 'f', status: 'REJECTED' }))).toBe('done');
  });
});

describe('buildQueue + queueCounts', () => {
  it('sorts critical first, then flagged, then pending, newest within each group', () => {
    const critical = makeReport({
      id: 'critical',
      depth: { code: 'head', label: 'Head Deep', approximateCm: 160 },
      createdAt: '2026-09-21T02:00:00.000Z',
    });
    const flagged = makeReport({
      id: 'flagged',
      status: 'ANOMALY',
      createdAt: '2026-09-21T03:00:00.000Z',
    });
    const pendingOld = makeReport({
      id: 'pending-old',
      createdAt: '2026-09-21T01:00:00.000Z',
    });
    const pendingNew = makeReport({ id: 'pending-new', createdAt: '2026-09-21T04:00:00.000Z' });
    const verified = makeReport({ id: 'verified', status: 'VERIFIED' });

    const queue = buildQueue([pendingNew, verified, critical, flagged, pendingOld], NOW);
    expect(queue.map((item) => item.report.id)).toEqual([
      'critical',
      'flagged',
      'pending-new',
      'pending-old',
    ]);

    expect(queueCounts([pendingNew, verified, critical, flagged, pendingOld])).toEqual({
      critical: 1,
      flagged: 1,
      pending: 2,
    });
  });
});

describe('hourlyBuckets', () => {
  it('places reports into the trailing 24 hourly slots, oldest first', () => {
    const nowHourStart = Math.floor(NOW / HOUR) * HOUR;
    const buckets = hourlyBuckets(
      [
        makeReport({ id: 'newest', createdAt: new Date(nowHourStart).toISOString() }),
        makeReport({ id: 'oldest', createdAt: new Date(nowHourStart - 23 * HOUR).toISOString() }),
        makeReport({ id: 'middle', createdAt: new Date(nowHourStart - 5 * HOUR).toISOString() }),
      ],
      24,
      NOW
    );
    expect(buckets).toHaveLength(24);
    expect(buckets[0].count).toBe(1); // oldest (23 hours back)
    expect(buckets[18].count).toBe(1); // 5 hours back
    expect(buckets[23].count).toBe(1); // current hour
    expect(buckets[3].count).toBe(0);
  });

  it('ignores reports outside the window', () => {
    const nowHourStart = Math.floor(NOW / HOUR) * HOUR;
    const buckets = hourlyBuckets(
      [makeReport({ id: 'too-old', createdAt: new Date(nowHourStart - 25 * HOUR).toISOString() })],
      24,
      NOW
    );
    expect(buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });
});

describe('depthDistribution', () => {
  it('returns every depth category in ankle -> overhead order with zeros', () => {
    const distribution = depthDistribution([
      makeReport({ id: 'a', depth: { code: 'head', label: 'Head Deep', approximateCm: 160 } }),
      makeReport({ id: 'b', depth: { code: 'ankle', label: 'Ankle Deep', approximateCm: 15 } }),
    ]);
    expect(distribution.map((slice) => slice.code)).toEqual([
      'ankle',
      'knee',
      'waist',
      'shoulder',
      'head',
      'overhead',
    ]);
    expect(distribution.find((slice) => slice.code === 'head')?.count).toBe(1);
    expect(distribution.find((slice) => slice.code === 'waist')?.count).toBe(0);
  });
});

describe('topSpots', () => {
  it('aggregates by normalized address and ranks by count', () => {
    const spots = topSpots([
      makeReport({ id: 'a', location: { latitude: 0, longitude: 0, address: 'Pala-o Market' } }),
      makeReport({ id: 'b', location: { latitude: 0, longitude: 0, address: 'Pala-o Market' } }),
      makeReport({ id: 'c', location: { latitude: 0, longitude: 0, address: 'Tibanga Bridge' } }),
    ]);
    expect(spots[0]).toEqual({ label: 'Pala-o Market', count: 2 });
    expect(spots[1]).toEqual({ label: 'Tibanga Bridge', count: 1 });
  });

  it('falls back to a placeholder for null addresses and honours the limit', () => {
    const none = makeReport({ id: 'a', location: { latitude: 8.2, longitude: 124.2, address: null } });
    expect(topSpots([none, none, none], 2)).toEqual([
      { label: 'Unnamed location', count: 3 },
    ]);
  });
});

describe('timeAgo', () => {
  it('produces friendly relative labels', () => {
    expect(timeAgo(new Date(NOW).toISOString(), NOW)).toBe('just now');
    expect(timeAgo(new Date(NOW - 9 * 60_000).toISOString(), NOW)).toBe('9m ago');
    expect(timeAgo(new Date(NOW - 2 * HOUR).toISOString(), NOW)).toBe('2h ago');
    expect(timeAgo(new Date(NOW - 50 * HOUR).toISOString(), NOW)).toBe('2d ago');
  });
});

describe('comparePeriods', () => {
  const at = (hoursAgo: number) =>
    makeReport({ id: `t-${hoursAgo}`, createdAt: new Date(NOW - hoursAgo * HOUR).toISOString() });

  it('splits a 48h list into last24 vs prev24 and reports the delta', () => {
    const result = comparePeriods([at(2), at(6), at(30), at(40)], NOW);
    expect(result.last24).toBe(2);
    expect(result.prev24).toBe(2);
    expect(result.delta).toBe(0);
    expect(result.trend).toBe('steady');
  });

  it('ignores reports older than 48h', () => {
    const result = comparePeriods([at(2), at(49), at(60)], NOW);
    expect(result.last24).toBe(1);
    expect(result.prev24).toBe(0);
  });

  it('marks >25% growth as rising', () => {
    expect(comparePeriods([at(1), at(2), at(3), at(30)], NOW).trend).toBe('rising');
  });

  it('marks >25% drop as falling', () => {
    expect(comparePeriods([at(2), at(30), at(31)], NOW).trend).toBe('falling');
  });

  it('handles an empty previous period without dividing by zero', () => {
    const result = comparePeriods([at(2)], NOW);
    expect(result.prev24).toBe(0);
    expect(result.trend).toBe('rising');
  });
});

describe('niceTicks', () => {
  it('produces round ascending ticks that cover the max value', () => {
    expect(niceTicks(9)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(3, 4)).toEqual([0, 1, 2, 3]);
  });

  it('caps with the exact max when it does not land on a step', () => {
    const ticks = niceTicks(7, 4);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(7);
  });
});

describe('deepestSpots', () => {
  it('groups by address and keeps the deepest recorded depth per spot', () => {
    const spots = deepestSpots([
      makeReport({
        id: 'a',
        location: { latitude: 0, longitude: 0, address: 'Pala-o Market' },
        depth: { code: 'knee', label: 'Knee Deep', approximateCm: 45 },
      }),
      makeReport({
        id: 'b',
        location: { latitude: 0, longitude: 0, address: 'Pala-o Market' },
        depth: { code: 'head', label: 'Head Deep', approximateCm: 160 },
      }),
      makeReport({
        id: 'c',
        location: { latitude: 0, longitude: 0, address: 'Tibanga Bridge' },
        depth: { code: 'shoulder', label: 'Shoulder Deep', approximateCm: 120 },
      }),
    ]);
    expect(spots[0].label).toBe('Pala-o Market');
    expect(spots[0].code).toBe('head');
    expect(spots[0].maxDepthCm).toBe(160);
    expect(spots[0].count).toBe(2);
    expect(spots[1].label).toBe('Tibanga Bridge');
    expect(spots[1].maxDepthCm).toBe(120);
  });

  it('ranks deepest first before volume and honours the limit', () => {
    const overhead = makeReport({
      id: 'x',
      location: { latitude: 0, longitude: 0, address: 'Riverside' },
      depth: { code: 'overhead', label: 'Overhead', approximateCm: 210 },
    });
    const manyShallow = Array.from({ length: 5 }, (_, index) =>
      makeReport({
        id: `m-${index}`,
        location: { latitude: 0, longitude: 0, address: 'Pala-o Market' },
        depth: { code: 'knee', label: 'Knee Deep', approximateCm: 45 },
      })
    );
    const spots = deepestSpots([overhead, ...manyShallow], 2);
    expect(spots[0].label).toBe('Riverside');
    expect(spots[1].label).toBe('Pala-o Market');
    expect(spots).toHaveLength(2);
  });

  it('falls back to a placeholder for null addresses', () => {
    const spots = deepestSpots([
      makeReport({ id: 'a', location: { latitude: 8.2, longitude: 124.2, address: null } }),
    ]);
    expect(spots[0].label).toBe('Unknown location');
  });
});