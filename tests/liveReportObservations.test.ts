import { describe, it, expect } from 'vitest';
import { liveReportGeoJson, liveObservationPollDelay, liveReportNotice } from '@/lib/map/liveReportObservations';
import type { LiveTimeline } from '@/types/liveFlood';

const now = Date.parse('2026-10-17T00:00:00Z');
const point = {
  report_id: 'report', latitude: 8.23, longitude: 124.24, depth_m: 0.45,
  observed_at: new Date(now - 60000).toISOString(), available_at: new Date(now - 1000).toISOString(),
  expires_at: new Date(now + 10000).toISOString(), depth_method: 'estimated',
  depth_uncertainty_m: null, location_accuracy_m: 5, source_group: 'source', fingerprint: 'fingerprint',
  correction_eligible: false, reasons: ['measurement_precision_unknown'],
};
const snapshot: NonNullable<LiveTimeline['report_observations']> = {
  captured_at: new Date(now).toISOString(), availability: 'available', reason: null,
  correction_method: 'observation_only', observations: [point],
};

describe('live report observation display', () => {
  it('distinguishes an unavailable source from no observations', () => {
    expect(liveReportNotice({ ...snapshot, availability: 'unavailable' })).toContain('unavailable');
    expect(liveReportNotice({ ...snapshot, observations: [] })).toBe('');
    expect(liveReportNotice(snapshot)).toContain('1 corroborated report group');
  });
  it('displays reported depth separately without changing the model raster', () => {
    expect(liveReportGeoJson(snapshot, true, now).features[0]).toMatchObject({
      geometry: { coordinates: [124.24, 8.23] }, properties: { depth_cm: 45 },
    });
  });
  it('hides observations on replay, forecast and static scenario frames', () => {
    expect(liveReportGeoJson(snapshot, false, now).features).toEqual([]);
  });
  it('removes expired points even if the network cannot refresh', () => {
    expect(liveReportGeoJson(snapshot, true, now + 10000).features).toEqual([]);
  });
  it('cannot display future-arriving observations or failed source reads', () => {
    expect(liveReportGeoJson({ ...snapshot, observations: [{ ...point, available_at: new Date(now + 1000).toISOString() }] }, true, now).features).toEqual([]);
    expect(liveReportGeoJson({ ...snapshot, availability: 'unavailable' }, true, now).features).toEqual([]);
  });
  it('refreshes at the next expiry and keeps bounded normal polling', () => {
    expect(liveObservationPollDelay(snapshot, 60000, now)).toBe(10000);
    expect(liveObservationPollDelay(undefined, 60000, now)).toBe(60000);
    expect(liveObservationPollDelay(snapshot, 60000, now + 20000)).toBe(60000);
  });
});
