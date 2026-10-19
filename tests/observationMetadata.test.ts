import { describe, expect, it } from 'vitest';
import { adjustedReportLocation, locationFromGps, reportObservationMetadata } from '@/lib/reports/observationMetadata';

describe('report observation provenance', () => {
  const fix = locationFromGps({ coords: { latitude: 8.23, longitude: 124.24, accuracy: 14 } as GeolocationCoordinates, timestamp: 1792123200000 });

  it('keeps the GPS fix accuracy and capture time', () => {
    expect(fix).toMatchObject({ source: 'gps', gpsAccuracyM: 14, locationCapturedAt: new Date(1792123200000).toISOString() });
  });

  it('marks slider depth as estimated and never claims scientific eligibility', () => {
    const metadata = reportObservationMetadata(fix);
    expect(metadata.depthMethod).toBe('estimated');
    expect(metadata).not.toHaveProperty('scientificEligibility');
    expect(metadata).not.toHaveProperty('depthUncertaintyCm');
  });

  it('preserves original GPS provenance while marking an adjusted pin', () => {
    const moved = adjustedReportLocation(fix, 8.231, 124.241);
    expect(moved).toMatchObject({ source: 'adjusted_gps', gpsAccuracyM: 14 });
    expect(reportObservationMetadata(moved)).toMatchObject({ gpsLatitude: fix.lat, gpsLongitude: fix.lng });
    const movedAgain = adjustedReportLocation(moved, 8.232, 124.242);
    expect(reportObservationMetadata(movedAgain)).toMatchObject({ gpsLatitude: fix.lat, gpsLongitude: fix.lng });
    expect(reportObservationMetadata(moved).locationSource).toBe('adjusted_gps');
    expect(adjustedReportLocation(fix, fix.lat, fix.lng)).toEqual(fix);
  });

  it('does not attach GPS accuracy to manually placed or unknown points', () => {
    const moved = adjustedReportLocation({ lat: 8.2, lng: 124.2, address: '', source: 'manual' }, 8.23, 124.24);
    expect(moved.source).toBe('manual');
    expect(reportObservationMetadata(moved).gpsAccuracyM).toBeUndefined();
    expect(reportObservationMetadata({ ...fix, source: 'unknown' }).gpsAccuracyM).toBeUndefined();
  });

  it('records measured depth as a claim with a measurement reference', () => {
    expect(reportObservationMetadata(fix, 'measured', ' ruler ')).toMatchObject({ depthMethod: 'measured', measurementReference: 'ruler' });
    expect(reportObservationMetadata(fix, 'estimated', 'ruler').measurementReference).toBeUndefined();
  });
});
