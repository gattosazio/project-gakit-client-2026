import { describe, expect, it } from 'vitest';
import {
  buildReportPopupHtml,
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
      depthLabel: 'Knee deep',
      statusLabel: 'Pending validation',
    });
    // The backend id is intentionally not copied onto map features.
    expect('id' in feature.properties).toBe(false);
  });

  it('falls back to a generic address label when none exists', () => {
    const collection = buildReportsGeoJson(
      [makeFeature({ id: 'b', address: null })],
      ALL_VISIBLE
    );
    expect(collection.features[0].properties.address).toBe('Flood report');
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

  it('renders report rows only for present fields', () => {
    const html = buildReportPopupHtml({
      properties: {
        kind: 'report',
        address: 'Test',
        depthLabel: 'Knee deep',
        statusLabel: 'Pending validation',
        createdAt: 'Aug 22',
      },
      geometry: { coordinates: [124.26, 8.22] },
    });
    expect(html).toContain('Depth');
    expect(html).toContain('Status');
    expect(html).not.toContain('Elevation');
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

describe('formatDepth', () => {
  const depth = (code: any) => ({ code, label: 'Waist deep', approximateCm: 90 });

  it('appends the "or deeper" qualifier only for overhead', () => {
    expect(formatDepth(depth('overhead'))).toContain('or deeper');
    expect(formatDepth(depth('waist'))).not.toContain('or deeper');
    expect(formatDepth(depth('waist'))).toContain('90 cm');
  });
});
