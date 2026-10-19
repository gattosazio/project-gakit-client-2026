import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentDemoReports, demoClock, demoTime, visibleDemoReports, type DemoReportInput } from '@/lib/demo/reports';
import { setDemoEnabled } from '@/lib/demo/settings';

afterEach(() => vi.unstubAllGlobals());
const reportAt = (minutes: number): DemoReportInput => ({
  id: String(minutes), reporter: 1, latitude: 8.2312, longitude: 124.247,
  depthCm: 45, observedAt: demoTime(minutes), gpsAccuracyM: 10, blocked: false,
});

describe('demo event clock', () => {
  it('reveals arrivals only when the simulated clock reaches them', () => {
    const reports = [reportAt(0), reportAt(10), reportAt(25)];
    expect(visibleDemoReports(reports, 0)).toHaveLength(1);
    expect(visibleDemoReports(reports, 10)).toHaveLength(2);
    expect(visibleDemoReports(reports, 25)).toHaveLength(3);
    expect(visibleDemoReports(reports, 0)).toHaveLength(1);
  });

  it('uses a separate deterministic clock and preserves different days', () => {
    expect(demoTime(10)).toBe('2026-01-01T00:10:00.000Z');
    expect(demoClock(1450)).toBe('Day 2 · 00:10');
  });

  it('keeps a late submission out of ordinary rewind and allows an explicit retrospective replay', () => {
    const report = { ...reportAt(10), submittedAt: demoTime(120) };
    expect(visibleDemoReports([report], 10)).toHaveLength(0);
    expect(visibleDemoReports([report], 120)).toHaveLength(1);
    expect(visibleDemoReports([report], 10, 120)).toHaveLength(1);
    expect(visibleDemoReports([report], 5, 120)).toHaveLength(0);
    expect(visibleDemoReports([report], 10, 119)).toHaveLength(0);
  });

  it('retains earlier markers without revealing observations ahead of the selected time', () => {
    const reports = [reportAt(0), reportAt(10), reportAt(120)];
    expect(currentDemoReports(reports, 0)).toHaveLength(1);
    expect(currentDemoReports(reports, 60)).toHaveLength(2);
    expect(currentDemoReports(reports, 85)).toHaveLength(2);
    expect(visibleDemoReports(reports, 85)).toHaveLength(2);
  });

  it('stores a tab preference without modifying auth or operational settings', () => {
    const setItem = vi.fn();
    const dispatchEvent = vi.fn();
    vi.stubGlobal('sessionStorage', { setItem });
    vi.stubGlobal('window', { dispatchEvent });
    setDemoEnabled(true);
    setDemoEnabled(false);
    expect(setItem.mock.calls).toEqual([['gakit.demo.enabled', 'true'], ['gakit.demo.enabled', 'false']]);
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
  });
});
