import { describe, expect, it } from 'vitest';
import {
  applyReportDeepLinkParams,
  consumeReportDeepLinkParams,
} from '@/app/monitoring/reportDeepLink';

describe('report deep link params', () => {
  it('pins the status and time window from a dashboard action', () => {
    const params = new URLSearchParams();
    applyReportDeepLinkParams(params, { status: 'UNVERIFIED', time: 'all' });
    expect(params.get('status')).toBe('UNVERIFIED');
    expect(params.get('time')).toBe('all');
  });

  it('defaults the time window to the last 24 hours and clears the status', () => {
    const params = new URLSearchParams('status=ANOMALY&time=48h');
    applyReportDeepLinkParams(params);
    expect(params.get('status')).toBeNull();
    expect(params.get('time')).toBe('24h');
  });

  it('leaves unrelated params untouched while applying', () => {
    const params = new URLSearchParams('tab=reports&notification=abc');
    applyReportDeepLinkParams(params, { status: 'ANOMALY', time: 'all' });
    expect(params.get('tab')).toBe('reports');
    expect(params.get('notification')).toBe('abc');
  });

  it('consumes the deep link so a later Reports visit cannot re-apply it', () => {
    const params = new URLSearchParams('tab=reports&status=UNVERIFIED&time=all');
    consumeReportDeepLinkParams(params);
    expect(params.get('status')).toBeNull();
    expect(params.get('time')).toBeNull();
    expect(params.get('tab')).toBe('reports');
  });

  it('lets the next dashboard action set a fresh slice after consumption', () => {
    const params = new URLSearchParams('tab=reports&status=UNVERIFIED&time=all');
    consumeReportDeepLinkParams(params);
    applyReportDeepLinkParams(params, { time: '24h' });
    expect(params.get('status')).toBeNull();
    expect(params.get('time')).toBe('24h');
  });
});
