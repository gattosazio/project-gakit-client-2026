import type { LiveTimeline } from '@/types/liveFlood';

/** Observation time and expiry remain independent of the model frame's rainfall. */
export function liveReportGeoJson(snapshot: LiveTimeline['report_observations'], enabled: boolean, now = Date.now()) {
  const points = enabled && snapshot?.availability === 'available'
    ? snapshot.observations.filter(point => Date.parse(point.expires_at) > now
      && Date.parse(point.observed_at) <= now && Date.parse(point.available_at) <= now) : [];
  return {
    type: 'FeatureCollection' as const,
    features: points.map(point => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.longitude, point.latitude] },
      properties: { report_id: point.report_id, depth_cm: Math.round(point.depth_m * 100) },
    })),
  };
}

export function liveObservationPollDelay(snapshot: LiveTimeline['report_observations'], defaultDelay: number, now = Date.now()) {
  const expiry = Math.min(...(snapshot?.observations.map(point => Date.parse(point.expires_at)).filter(value => value > now) ?? []));
  return Math.max(500, Math.min(defaultDelay, expiry - now));
}

export function liveReportNotice(snapshot: LiveTimeline['report_observations']): string {
  if (snapshot?.availability === 'unavailable') return 'Report observations unavailable.';
  const count = snapshot?.observations.length ?? 0;
  return count ? `${count} corroborated report ${count === 1 ? 'group' : 'groups'} shown separately.` : '';
}
