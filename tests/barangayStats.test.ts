import { describe, expect, it } from 'vitest';
import {
  aggregateBarangayStats,
  barangayBanner,
  BARANGAY_BANNER_COPY,
  buildBarangaySeverityGeoJson,
  severityFill,
} from '@/lib/map/barangayStats';
import { DEPTH_BAR_COLOR } from '@/lib/reports/reportFormatting';
import type { GeoJsonCollection } from '@/lib/map/geoUtils';
import type { MapReportFeature } from '@/types/report';

// Two simple square barangays, PSGC-keyed like the NAMRIA file.
const geojson: GeoJsonCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { adm4_psgc: '1', adm4_en: 'Pala-o' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[124, 8], [124.01, 8], [124.01, 8.01], [124, 8.01], [124, 8]]],
      },
    },
    {
      type: 'Feature',
      properties: { adm4_psgc: '2', adm4_en: 'Tibanga' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[124.02, 8], [124.03, 8], [124.03, 8.01], [124.02, 8.01], [124.02, 8]]],
      },
    },
  ],
};

const report = (
  status: MapReportFeature['properties']['status'],
  depthCode: MapReportFeature['properties']['depth']['code'],
  lng: number,
  lat: number,
  createdAt = '2026-09-21T00:00:00.000Z'
): MapReportFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lng, lat] },
  properties: {
    id: 'r-' + Math.random().toString(36).slice(2, 8),
    address: null,
    depth: { code: depthCode, label: depthCode, approximateCm: 90 },
    depthCm: null,
    reference: null,
    status,
    observedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  },
});

describe('aggregateBarangayStats', () => {
  it('joins each report into its barangay and tallies counts', () => {
    const stats = aggregateBarangayStats(
      [
        report('VERIFIED', 'knee', 124.005, 8.005, '2026-09-21T01:00:00.000Z'),
        report('UNVERIFIED', 'ankle', 124.006, 8.006, '2026-09-21T02:00:00.000Z'),
        report('UNVERIFIED', 'head', 124.007, 8.007, '2026-09-21T03:00:00.000Z'),
        report('VERIFIED', 'waist', 124.025, 8.005, '2026-09-21T04:00:00.000Z'),
      ],
      geojson
    );

    expect(stats.size).toBe(2);

    const palao = stats.get('1')!;
    expect(palao.name).toBe('Pala-o');
    expect(palao.total).toBe(3);
    expect(palao.verified).toBe(1);
    expect(palao.unverified).toBe(2);
    expect(palao.flagged).toBe(0);
    expect(palao.worstDepth).toBe('head');
    expect(palao.depthCounts).toMatchObject({ knee: 1, ankle: 1, head: 1 });
    expect(palao.newestAt).toBe('2026-09-21T03:00:00.000Z');

    const tibanga = stats.get('2')!;
    expect(tibanga.total).toBe(1);
    expect(tibanga.worstDepth).toBe('waist');
  });

  it('ignores REJECTED reports entirely', () => {
    const stats = aggregateBarangayStats(
      [report('REJECTED', 'head', 124.005, 8.005), report('VERIFIED', 'ankle', 124.005, 8.005)],
      geojson
    );
    const palao = stats.get('1')!;
    expect(palao).toBeDefined();
    expect(palao.total).toBe(1);
    expect(palao.verified).toBe(1);
    // The rejected head-deep report must not drive severity or counts.
    expect(palao.worstDepth).toBe('ankle');
    expect(palao.depthCounts).toMatchObject({ ankle: 1 });
  });

  it('returns an empty map for missing geojson', () => {
    expect(aggregateBarangayStats([report('VERIFIED', 'ankle', 124.005, 8.005)], null).size).toBe(0);
  });
});

describe('barangayBanner', () => {
  it('is none when nothing was reported', () => {
    expect(barangayBanner(null)).toBe('none');
    expect(barangayBanner({ total: 0 } as never)).toBe('none');
  });

  it('prioritizes head-deep or worse as critical', () => {
    const statsBarangay = aggregateBarangayStats(
      [report('UNVERIFIED', 'overhead', 124.005, 8.005)],
      geojson
    );
    expect(barangayBanner(statsBarangay.get('1'))).toBe('critical');
  });

  it('flags pending when any report is unverified', () => {
    const statsBarangay = aggregateBarangayStats(
      [report('UNVERIFIED', 'ankle', 124.005, 8.005)],
      geojson
    );
    expect(barangayBanner(statsBarangay.get('1'))).toBe('pending');
  });

  it('reports flooded when only verified reports exist', () => {
    const statsBarangay = aggregateBarangayStats(
      [report('VERIFIED', 'knee', 124.005, 8.005)],
      geojson
    );
    expect(barangayBanner(statsBarangay.get('1'))).toBe('flooded');
  });

  it('has honest copy for every banner kind', () => {
    expect(Object.keys(BARANGAY_BANNER_COPY).sort()).toEqual(
      ['none', 'pending', 'flooded', 'critical'].sort()
    );
  });
});

describe('severityFill', () => {
  it('uses the shared depth color for flooded barangays at low alpha', () => {
    const statsBarangay = aggregateBarangayStats(
      [report('VERIFIED', 'head', 124.005, 8.005)],
      geojson
    );
    expect(severityFill(statsBarangay.get('1'))).toMatch(/^rgba\(239, 68, 68, 0\.16\)$/);
  });

  it('renders a neutral slate for barangays with no reports', () => {
    expect(severityFill(null)).toBe('rgba(100, 116, 139, 0.10)');
    expect(severityFill(undefined)).toBe('rgba(100, 116, 139, 0.10)');
  });
});

describe('buildBarangaySeverityGeoJson', () => {
  it('keeps all polygons and stamps a fill per barangay', () => {
    const stats = aggregateBarangayStats(
      [report('VERIFIED', 'ankle', 124.005, 8.005)],
      geojson
    );
    const payload = buildBarangaySeverityGeoJson(geojson, stats);

    expect(payload.features).toHaveLength(2);
    const palao = payload.features.find((f) => f.properties?.adm4_psgc === '1')!;
    expect(palao.properties?.fill).toBe(`rgba(${hexRgb(DEPTH_BAR_COLOR.ankle)}, 0.16)`);
    const tibanga = payload.features.find((f) => f.properties?.adm4_psgc === '2')!;
    expect(tibanga.properties?.fill).toBe('rgba(100, 116, 139, 0.10)');
  });
});

function hexRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}