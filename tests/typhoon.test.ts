import { describe, expect, it } from 'vitest';
import {
  buildTyphoonPopupHtml,
  getTyphoonCategoryColor,
  getTyphoonCategoryLabel,
  PAR_BOUNDARY_GEOJSON,
  PRIMARY_TYPHOON_CATEGORIES,
  TYPHOON_CATEGORY_CONFIG,
} from '@/lib/map/typhoon';
import { convertPanahonToGeoJSON, type PanahonCycloneItem } from '@/lib/map/panahon';

describe('typhoon utilities', () => {
  it('has valid PAR boundary GeoJSON', () => {
    expect(PAR_BOUNDARY_GEOJSON.type).toBe('FeatureCollection');
    expect(PAR_BOUNDARY_GEOJSON.features.length).toBeGreaterThan(0);
    const coords = PAR_BOUNDARY_GEOJSON.features[0].geometry.coordinates[0];
    expect(coords.length).toBe(7); // Closed polygon with 6 vertices + 1 wrap
  });

  it('resolves category colors and labels properly', () => {
    expect(getTyphoonCategoryColor('TD')).toBe(TYPHOON_CATEGORY_CONFIG.TD.color);
    expect(getTyphoonCategoryColor('TS')).toBe(TYPHOON_CATEGORY_CONFIG.TS.color);
    expect(getTyphoonCategoryColor('TY')).toBe(TYPHOON_CATEGORY_CONFIG.TY.color);
    expect(getTyphoonCategoryColor('STY')).toBe(TYPHOON_CATEGORY_CONFIG.STY.color);
    expect(getTyphoonCategoryColor('LPA')).toBe(TYPHOON_CATEGORY_CONFIG.LPA.color);
    expect(getTyphoonCategoryColor('AA')).toBe(TYPHOON_CATEGORY_CONFIG.LPA.color); // Normalized
    expect(getTyphoonCategoryLabel('STY')).toBe('Super Typhoon');
    expect(getTyphoonCategoryLabel('LPA')).toBe('Low Pressure Area');
    expect(getTyphoonCategoryLabel('AA')).toBe('Low Pressure Area');
  });

  it('builds popup HTML with storm parameters and forecast radius', () => {
    const html = buildTyphoonPopupHtml({
      local_name: 'OBET',
      international_name: 'SAUDEL',
      typhoon_type: 'TY',
      windspeed: 120,
      pressure: 975,
      latitude: 15.2,
      longitude: 126.4,
      datetime: '2026-08-21T08:00:00',
      radius: 100,
    });

    expect(html).toContain('Bagyong OBET');
    expect(html).toContain('SAUDEL');
    expect(html).toContain('120 km/h');
    expect(html).toContain('975 hPa');
    expect(html).toContain('Forecast Radius');
    expect(html).toContain('± 100 km');
    expect(html).toContain('Date/Time:');
  });

  it('handles missing properties gracefully in popup HTML', () => {
    const html = buildTyphoonPopupHtml({
      latitude: 10.0,
      longitude: 125.0,
      datetime: '',
    });

    expect(html).toContain('Tropical Cyclone');
    expect(html).toContain('10.0°N, 125.0°E');
    expect(html).toContain('Date/Time:');
  });

  it('strips empty braces and formatting artefacts from popup title', () => {
    const html = buildTyphoonPopupHtml({
      local_name: 'PILANDOK{}',
      latitude: 20.8,
      longitude: 133.8,
      typhoon_type: 'TD',
    });

    expect(html).toContain('Bagyong PILANDOK');
    expect(html).not.toContain('{}');
    expect(html).not.toContain('()');
  });

  it('contains exactly the 6 official DOST-PAGASA categories in PRIMARY_TYPHOON_CATEGORIES', () => {
    expect(PRIMARY_TYPHOON_CATEGORIES).toEqual(['STY', 'TY', 'STS', 'TS', 'TD', 'LPA']);
    PRIMARY_TYPHOON_CATEGORIES.forEach((code) => {
      expect(TYPHOON_CATEGORY_CONFIG[code]).toBeDefined();
      expect(TYPHOON_CATEGORY_CONFIG[code].color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it('converts live Panahon cyclone payload into valid GeoJSON', () => {
    const samplePanahon: PanahonCycloneItem[] = [
      {
        cyclone_name: 'PILANDOK{}',
        info: {
          '2026-08-30 08:00': {
            cyclone_type: 'TD',
            date: '2026-08-30',
            time: '08:00',
            latitude: '20.8',
            longitude: '133.8',
            radius: '0',
          },
          '2026-08-31 08:00': {
            cyclone_type: 'TD',
            date: '2026-08-31',
            time: '08:00',
            latitude: '21.3',
            longitude: '131.6',
            radius: '80',
          },
          '2026-09-01 08:00': {
            cyclone_type: 'LPA',
            date: '2026-09-01',
            time: '08:00',
            latitude: '23.8',
            longitude: '129.2',
            radius: '153',
          },
        },
      },
    ];

    const geojson = convertPanahonToGeoJSON(samplePanahon);
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features.length).toBeGreaterThan(0);

    const points = geojson.features.filter((f) => f.geometry.type === 'Point');
    expect(points.length).toBe(3);
    expect(points[0].properties?.typhoon_name).toBe('PILANDOK');
    expect(points[0].properties?.typhoon_type).toBe('TD');

    const lines = geojson.features.filter((f) => f.geometry.type === 'LineString');
    expect(lines.length).toBe(1);

    const cones = geojson.features.filter((f) => f.geometry.type === 'MultiPolygon');
    expect(cones.length).toBe(1);
  });

  it('correctly parses dual-named typhoons and multiple simultaneous storms', () => {
    const multiStorms: PanahonCycloneItem[] = [
      {
        cyclone_name: 'KRISTINE{TRAMI}',
        info: {
          '2026-10-22 08:00': {
            cyclone_type: 'STS',
            date: '2026-10-22',
            time: '08:00',
            latitude: '15.5',
            longitude: '124.0',
            radius: '0',
          },
          '2026-10-23 08:00': {
            cyclone_type: 'TY',
            date: '2026-10-23',
            time: '08:00',
            latitude: '16.8',
            longitude: '121.5',
            radius: '120',
          },
        },
      },
      {
        cyclone_name: 'LEON{KONG-REY}',
        info: {
          '2026-10-25 08:00': {
            cyclone_type: 'STY',
            date: '2026-10-25',
            time: '08:00',
            latitude: '18.0',
            longitude: '130.0',
            radius: '0',
          },
          '2026-10-26 08:00': {
            cyclone_type: 'STY',
            date: '2026-10-26',
            time: '08:00',
            latitude: '20.0',
            longitude: '125.0',
            radius: '140',
          },
        },
      },
    ];

    const geojson = convertPanahonToGeoJSON(multiStorms);
    const points = geojson.features.filter((f) => f.geometry.type === 'Point');
    expect(points.length).toBe(4);

    const kristinePoint = points.find((p) => p.properties?.local_name === 'KRISTINE');
    expect(kristinePoint).toBeDefined();
    expect(kristinePoint?.properties?.international_name).toBe('TRAMI');
    expect(kristinePoint?.properties?.typhoon_name).toBe('KRISTINE (TRAMI)');

    const leonPoint = points.find((p) => p.properties?.local_name === 'LEON');
    expect(leonPoint).toBeDefined();
    expect(leonPoint?.properties?.international_name).toBe('KONG-REY');
    expect(leonPoint?.properties?.typhoon_type).toBe('STY');

    const lines = geojson.features.filter((f) => f.geometry.type === 'LineString');
    expect(lines.length).toBe(2);

    const cones = geojson.features.filter((f) => f.geometry.type === 'MultiPolygon');
    expect(cones.length).toBe(2);
  });
});
