import { describe, expect, it } from 'vitest';
import {
  buildReportPopupHtml,
  buildReportHoverHtml,
  buildReportClusterHoverHtml,
  buildReportsGeoJson,
  buildSelectedGeoJson,
  formatDepth,
} from '@/lib/map/reportMarkers';
import type { MapReportFeature } from '@/types/report';

const ALL_VISIBLE = { UNVERIFIED: true, VERIFIED: true, ANOMALY: true, REJECTED: true };

function makeFeature(overrides: Partial<MapReportFeature['properties']> & { id: string }): MapReportFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [124.26, 8.22] },
    properties: {
      address: 'Quezon Ave',
      depth: { code: 'knee', label: 'Knee deep', approximateCm: 45 },
      status: 'UNVERIFIED',
      observedAt: '2026-08-22T01:00:00Z',
      createdAt: '2026-08-22T01:00:00Z',
      updatedAt: '2026-08-22T01:00:00Z',
      ...overrides,
    },
  };
}

describe('buildReportsGeoJson', () => {
  it('converts backend points into report features with display labels', () => {
    const collection = buildReportsGeoJson([makeFeature({ id: 'a' })], ALL_VISIBLE);

    expect(collection.type).toBe('FeatureCollection');
    const [feature] = collection.features;
    expect(feature.properties).toMatchObject({
      kind: 'report',
      address: 'Quezon Ave',
      depthLabel: 'Knee deep (45 cm)',
      statusLabel: 'Pending validation',
    });
    // The backend id is copied onto map features so pin clicks can resolve the report.
    expect(feature.properties.id).toBe('a');
  });

  it('keeps address null when none exists (no generic fallback label)', () => {
    const collection = buildReportsGeoJson(
      [makeFeature({ id: 'b', address: null })],
      ALL_VISIBLE
    );
    expect(collection.features[0].properties.address).toBeNull();
  });

  it('drops reports whose status is filtered out', () => {
    const collection = buildReportsGeoJson(
      [makeFeature({ id: 'c', status: 'REJECTED' })],
      { ...ALL_VISIBLE, REJECTED: false }
    );
    expect(collection.features).toHaveLength(0);
  });

  it('deduplicates by report id (first occurrence wins)', () => {
    const collection = buildReportsGeoJson(
      [makeFeature({ id: 'd' }), makeFeature({ id: 'd' })],
      ALL_VISIBLE
    );
    expect(collection.features).toHaveLength(1);
  });

  it('skips features without an id entirely', () => {
    const feature = makeFeature({ id: 'e' });
    (feature.properties as any).id = undefined;
    const collection = buildReportsGeoJson([feature], ALL_VISIBLE);
    expect(collection.features).toHaveLength(0);
  });
});

describe('buildSelectedGeoJson', () => {
  it('returns an empty collection when nothing is selected', () => {
    expect(buildSelectedGeoJson(null)).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });

  it('wraps the selected coordinate as a lng/lat point', () => {
    const collection = buildSelectedGeoJson({ lat: 8.22, lng: 124.26 });
    expect(collection.features[0].geometry.coordinates).toEqual([124.26, 8.22]);
    expect(collection.features[0].properties.kind).toBe('selected');
  });
});

describe('buildReportPopupHtml', () => {
  it('renders the selected-location variant with coordinates', () => {
    const html = buildReportPopupHtml({
      properties: { kind: 'selected' },
      geometry: { coordinates: [124.2601, 8.2202] },
    });
    expect(html).toContain('Selected location');
    expect(html).toContain('8.2202');
    expect(html).toContain('124.2601');
  });

  it('shows the reported depth and location without the former assessment rows', () => {
    const html = buildReportPopupHtml({
      properties: {
        kind: 'report',
        address: 'Test',
        depthLabel: 'Knee deep',
        statusLabel: 'Pending validation',
        createdAt: 'Aug 22',
        demoAutoValidated: true,
        validationScore: 4,
        verificationScope: 'flood_presence',
      },
      geometry: { coordinates: [124.26, 8.22] },
    });
    expect(html).toContain('Reported depth');
    expect(html).toContain('Knee deep');
    expect(html).toContain('Pending validation');
    expect(html).not.toContain('Origin');
    expect(html).not.toContain('evidence checks skipped');
    expect(html).not.toContain('Verification');
    expect(html).not.toContain('Score');
    expect(html).not.toContain('Elevation');
  });

  it('keeps hover to depth, status and age, with escaped user content', () => {
    const html = buildReportHoverHtml({ properties: {
      depthLabel: '<img src=x>', status: 'VERIFIED', address: 'Long address omitted',
      createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    } });
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('Verified');
    expect(html).toContain('5m ago');
    expect(html).not.toContain('Long address omitted');
    expect(html).not.toContain('<img');
  });

  it('escapes HTML in user-controlled values', () => {
    const html = buildReportPopupHtml({
      properties: {
        kind: 'report',
        address: '<script>alert("x")</script>',
      },
      geometry: { coordinates: [0, 0] },
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('buildReportClusterHoverHtml', () => {
  it('shows the cluster count and expansion action without individual report details', () => {
    const html = buildReportClusterHoverHtml({ properties: { point_count: 12, address: 'Not in the preview' } });
    expect(html).toContain('12 reports');
    expect(html).toContain('Click to expand');
    expect(html).not.toContain('Not in the preview');
    expect(buildReportClusterHoverHtml({ properties: { point_count: '<script>' } })).not.toContain('<script>');
  });
});

describe('formatDepth', () => {
  const depth = (code: any) => ({ code, label: 'Waist deep', approximateCm: 90 });

  it('appends the "+" qualifier only for overhead', () => {
    expect(formatDepth(depth('overhead'))).toContain('+ cm');
    expect(formatDepth(depth('waist'))).not.toContain('+ cm');
    expect(formatDepth(depth('waist'))).toContain('90 cm');
  });
});

describe('formatReportWindowSubtitle', () => {
  it('formats subtitle with report counts correctly', async () => {
    const { formatReportWindowSubtitle } = await import('@/components/map/MapControls');
    expect(formatReportWindowSubtitle(48, 12)).toBe('Showing 12 reports from the last 48 hours');
    expect(formatReportWindowSubtitle(48, 1)).toBe('Showing 1 report from the last 48 hours');
    expect(formatReportWindowSubtitle(48, 0)).toBe('Showing 0 reports from the last 48 hours');
    expect(formatReportWindowSubtitle(null, 5)).toBe('Showing 5 reports from all time');
    expect(formatReportWindowSubtitle(24, 3)).toBe('Showing 3 reports from the last 24 hours');
    expect(formatReportWindowSubtitle(72, 8)).toBe('Showing 8 reports from the last 3 days');
    expect(formatReportWindowSubtitle(12, 2)).toBe('Showing 2 reports from the last 12 hours');
    expect(formatReportWindowSubtitle(48)).toBe('Showing reports from the last 48 hours');
  });
});

