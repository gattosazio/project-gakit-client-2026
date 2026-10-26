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

  it('clears stale URL filters so general navigation preserves the table filters', () => {
    const params = new URLSearchParams('status=ANOMALY&time=48h');
    applyReportDeepLinkParams(params);
    expect(params.get('status')).toBeNull();
    expect(params.get('time')).toBeNull();
  });

  it('opens a specific report without overriding the table window', () => {
    const params = new URLSearchParams('tab=reports&status=UNVERIFIED&time=all');
    applyReportDeepLinkParams(params, { reportId: 'older-report' });
    expect(params.get('status')).toBeNull();
    expect(params.get('time')).toBeNull();
    expect(params.get('tab')).toBe('reports');
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
