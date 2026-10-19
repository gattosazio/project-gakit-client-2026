import { describe, expect, it } from 'vitest';
import { readDemoBehaviors } from '@/lib/demo/behaviors';
import { demoTime } from '@/lib/demo/reports';

const behavior = {
  id: '00000000-0000-4000-8000-000000000001', name: 'Edge correction', savedAt: new Date().toISOString(),
  preset: 'pagasa_orange', minutes: 960, inspectionMinutes: 900, approveFixtures: false,
  location: { latitude: 8.2312, longitude: 124.247 }, reports: [{
    id: '00000000-0000-4000-8000-000000000002', reporter: 7, latitude: 8.2312, longitude: 124.247,
    depthCm: 90, observedAt: demoTime(900), submittedAt: demoTime(960), gpsAccuracyM: 10,
    locationSource: 'manual', depthMethod: 'measured', depthUncertaintyCm: 10, blocked: false,
  }],
};

describe('saved demo behaviors', () => {
  it('preserves the scene and late-report measurement details without trusting saved results', () => {
    const [saved] = readDemoBehaviors(JSON.stringify([{ ...behavior, status: 'VERIFIED', patches: ['untrusted'],
      reports: [{ ...behavior.reports[0], status: 'VERIFIED', rainAtObservationMm: 999 }] }]));
    expect(saved).toEqual(behavior);
  });

  it('ignores corrupt records and unavailable storms without losing other saved scenes', () => {
    expect(readDemoBehaviors('{broken')).toEqual([]);
    expect(readDemoBehaviors(JSON.stringify({ ...behavior }))).toEqual([]);
    expect(readDemoBehaviors(JSON.stringify([
      { ...behavior, preset: 'live' }, { ...behavior, inspectionMinutes: 961 },
      { ...behavior, reports: [{ ...behavior.reports[0], latitude: null }] }, behavior,
    ]))).toEqual([behavior]);
  });
});
