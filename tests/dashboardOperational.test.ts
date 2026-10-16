import { describe, expect, it } from 'vitest';
import { inflowInterval, inflowSummary, manilaTime, sourceState } from '@/app/monitoring/features/dashboard/operational';
import type { DashboardHour, DashboardSnapshot } from '@/types/dashboard';

const hour = (at: string, count: number): DashboardHour => ({ at, count, verified: count, pending: 0, flagged: 0, rejected: 0 });
const snapshot = {
  asOf: '2026-10-16T05:30:00Z', windowStart: '2026-10-15T05:30:00Z',
  totals: { submissions: 20, previousSubmissions: 28 },
  hourly: [hour('2026-10-15T05:00:00Z', 9), hour('2026-10-16T04:00:00Z', 4), hour('2026-10-16T05:00:00Z', 7)],
} as DashboardSnapshot;

describe('dashboard source timing', () => {
  const now = Date.parse('2026-10-16T05:00:00Z');
  it('keeps missing, old and future-dated data distinct from fresh data', () => {
    expect(sourceState(null, now, 180)).toBe('unavailable');
    expect(sourceState('not a date', now, 180)).toBe('unavailable');
    expect(sourceState('2026-10-16T01:00:00Z', now, 180)).toBe('delayed');
    expect(sourceState('2026-10-16T06:00:00Z', now, 180)).toBe('delayed');
    expect(sourceState('2026-10-16T04:00:00Z', now, 180)).toBe('fresh');
  });
  it('formats local times in Manila irrespective of browser timezone', () => {
    expect(manilaTime('2026-10-16T05:00:00Z')).toContain('1:00');
  });
});

describe('report inflow', () => {
  it('clips edge hours to the exact 24-hour window', () => {
    expect(inflowInterval(snapshot.hourly[0], snapshot)).toEqual({ start: '2026-10-15T05:30:00.000Z', end: '2026-10-15T06:00:00.000Z', partial: true });
    expect(inflowInterval(snapshot.hourly[2], snapshot)).toEqual({ start: '2026-10-16T05:00:00.000Z', end: '2026-10-16T05:30:00.000Z', partial: true });
  });
  it('compares intake and chooses a complete hour for the peak', () => {
    expect(inflowSummary(snapshot)).toEqual({ delta: -8, peak: snapshot.hourly[1] });
  });
  it('does not invent a busiest hour for an empty window', () => {
    expect(inflowSummary({ ...snapshot, hourly: [hour('2026-10-16T04:00:00Z', 0)] }).peak).toBeNull();
  });
});
