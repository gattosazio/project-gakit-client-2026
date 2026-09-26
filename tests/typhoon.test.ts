import { describe, expect, it } from 'vitest';
import {
  buildTyphoonPopupHtml,
  enrichTyphoonTrackGeoJson,
  formatTrackDateLabel,
  formatTyphoonDisplayName,
  getTyphoonCategoryColor,
  getTyphoonCategoryLabel,
  PAR_BOUNDARY_GEOJSON,
  PRIMARY_TYPHOON_CATEGORIES,
  TYPHOON_CATEGORY_CONFIG,
} from '@/lib/map/typhoon';
import { convertPanahonToGeoJSON, type PanahonCycloneItem } from '@/lib/map/panahon';
import {
  clearCurrentStormMarkers,
  createCurrentStormMarkerElement,
  syncCurrentStormMarkers,
} from '@/lib/map/typhoonMarker';

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

    expect(html).toContain('OBET (SAUDEL)');
    expect(html).not.toContain('Bagyong');
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

  it('strips empty braces, formatting artefacts, and Bagyong prefix from popup title', () => {
    const html = buildTyphoonPopupHtml({
      local_name: 'PILANDOK{}',
      latitude: 20.8,
      longitude: 133.8,
      typhoon_type: 'TD',
    });

    expect(html).toContain('PILANDOK');
    expect(html).not.toContain('Bagyong');
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
    expect(points[0].properties?.is_current).toBe(true);
    expect(points[0].properties?.date_label).toContain('Aug 30');
    expect(points[0].properties?.current_label).toContain('Current:');
    expect(points[1].properties?.is_current).toBe(false);
    expect(points[1].properties?.current_label).toBe('');

    const lines = geojson.features.filter((f) => f.geometry.type === 'LineString');
    expect(lines.length).toBe(2);
    expect(lines[0].properties?.typhoon_type).toBe('TD');
    expect(lines[0].properties?.color).toBe(TYPHOON_CATEGORY_CONFIG.TD.color);
    expect(lines[1].properties?.typhoon_type).toBe('LPA');
    expect(lines[1].properties?.color).toBe(TYPHOON_CATEGORY_CONFIG.LPA.color);

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

  it('formats typhoon display names stripping Bagyong while retaining international name', () => {
    expect(formatTyphoonDisplayName('Bagyong KRISTINE', 'TRAMI')).toBe('KRISTINE (TRAMI)');
    expect(formatTyphoonDisplayName('Bagyong KRISTINE {TRAMI}')).toBe('KRISTINE (TRAMI)');
    expect(formatTyphoonDisplayName('Bagyong OBET (SAUDEL)')).toBe('OBET (SAUDEL)');
    expect(formatTyphoonDisplayName('Bagyong PILANDOK{}')).toBe('PILANDOK');
    expect(formatTyphoonDisplayName('PILANDOK')).toBe('PILANDOK');
    expect(formatTyphoonDisplayName('KRISTINE', 'KRISTINE')).toBe('KRISTINE');
    expect(formatTyphoonDisplayName('', '')).toBe('Tropical Cyclone');
  });

  it('enriches raw GeoJSON track with current anchor, date labels, and cleaned storm names', () => {
    const rawTrack = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [125.0, 15.0] },
          properties: {
            typhoon_name: 'Bagyong KRISTINE (TRAMI)',
            local_name: 'Bagyong KRISTINE',
            international_name: 'TRAMI',
            typhoon_type: 'TS',
            radius: 0,
            date: '2026-10-22',
            time: '02:00',
            datetime: '2026-10-22T02:00:00',
          },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [124.0, 15.5] },
          properties: {
            typhoon_name: 'Bagyong KRISTINE (TRAMI)',
            local_name: 'Bagyong KRISTINE',
            international_name: 'TRAMI',
            typhoon_type: 'STS',
            radius: 0,
            date: '2026-10-22',
            time: '08:00',
            datetime: '2026-10-22T08:00:00',
          },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [121.5, 16.8] },
          properties: {
            typhoon_name: 'Bagyong KRISTINE (TRAMI)',
            local_name: 'Bagyong KRISTINE',
            international_name: 'TRAMI',
            typhoon_type: 'TY',
            radius: 120,
            date: '2026-10-23',
            time: '08:00',
            datetime: '2026-10-23T08:00:00',
          },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [125.0, 15.0],
              [124.0, 15.5],
              [121.5, 16.8],
            ],
          },
          properties: {
            type: 'track_line',
            typhoon_name: 'Bagyong KRISTINE (TRAMI)',
          },
        },
      ],
    };

    const enriched = enrichTyphoonTrackGeoJson(rawTrack);
    const points = enriched.features.filter((f: any) => f.geometry.type === 'Point');
    expect(points.length).toBe(3);

    // First past point: radius 0, but not latest observation
    expect(points[0].properties.is_current).toBe(false);
    expect(points[0].properties.current_label).toBe('');
    expect(points[0].properties.date_label).toContain('Oct 22');
    expect(points[0].properties.typhoon_name).toBe('KRISTINE (TRAMI)');
    expect(points[0].properties.local_name).toBe('KRISTINE');

    // Second point: latest radius 0 -> current anchor!
    expect(points[1].properties.is_current).toBe(true);
    expect(points[1].properties.current_label).toContain('Current: Oct 22');
    expect(points[1].properties.current_label).not.toContain('●');
    expect(points[1].properties.date_label).toContain('Oct 22');

    // Third point: forecast milestone (radius 120 > 0)
    expect(points[2].properties.is_current).toBe(false);
    expect(points[2].properties.current_label).toBe('');
    expect(points[2].properties.date_label).toContain('Oct 23');

    // LineString check: segmented into solid past track and dashed forecast track with category colors
    const lines = enriched.features.filter((f: any) => f.geometry.type === 'LineString');
    expect(lines.length).toBe(2);

    // Segment 0: past track up to current point (solid)
    expect(lines[0].properties.typhoon_name).toBe('KRISTINE (TRAMI)');
    expect(lines[0].properties.track_type).toBe('past');
    expect(lines[0].properties.is_forecast).toBe(false);
    expect(lines[0].properties.typhoon_type).toBe('TS');
    expect(lines[0].properties.color).toBe(TYPHOON_CATEGORY_CONFIG.TS.color);

    // Segment 1: forecast track after current point (dashed)
    expect(lines[1].properties.typhoon_name).toBe('KRISTINE (TRAMI)');
    expect(lines[1].properties.track_type).toBe('forecast');
    expect(lines[1].properties.is_forecast).toBe(true);
    expect(lines[1].properties.typhoon_type).toBe('TY');
    expect(lines[1].properties.color).toBe(TYPHOON_CATEGORY_CONFIG.TY.color);
  });

  it('guarantees right padding in popup header to prevent close button collision', () => {
    const html = buildTyphoonPopupHtml({
      local_name: 'SUPER LONG TYPHOON NAME TESTING TRUNCATION',
      international_name: 'INTERNATIONAL_NAME',
      typhoon_type: 'STY',
      latitude: 16.0,
      longitude: 125.0,
    });
    expect(html).toContain('padding-right: 36px');
    expect(html).toContain('truncate min-w-0 flex-1');
  });

  it('normalizes space-separated datetime strings for Safari/WebKit compatibility', () => {
    // Space separated datetime strings
    const labelFromSpace = formatTrackDateLabel('', '', '2026-08-30 08:00');
    expect(labelFromSpace).toContain('Aug 30');
    expect(labelFromSpace).toContain('8:00 AM');

    const labelFromDateAndTime = formatTrackDateLabel('2026-10-22', '14:00');
    expect(labelFromDateAndTime).toContain('Oct 22');
    expect(labelFromDateAndTime).toContain('2:00 PM');
  });

  it('safely handles SSR environment when document is undefined', () => {
    // In node environment without document, returns null without throwing
    const res = createCurrentStormMarkerElement({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [125.0, 15.0] },
      properties: {
        typhoon_name: 'KRISTINE',
        typhoon_type: 'TY',
        date_label: 'Oct 22, 8:00 AM',
      },
    });
    expect(res).toBeNull();
  });

  it('constructs DOM marker with minimal slate date label', () => {
    // Provide minimal mock DOM for marker rendering test
    const createdElements: Array<{ tag: string; attrs: Record<string, string>; styles: Record<string, string> }> = [];
    const listeners: Record<string, (e?: any) => void> = {};

    const mockElement = (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        innerHTML: '',
        children: [] as any[],
        setAttribute: (k: string, v: string) => {
          el.attrs = el.attrs || {};
          el.attrs[k] = v;
        },
        appendChild: (child: any) => {
          el.children.push(child);
          return child;
        },
        addEventListener: (event: string, handler: any) => {
          listeners[event] = handler;
        },
      };
      return el;
    };

    const originalDoc = (global as any).document;
    try {
      (global as any).document = {
        createElement: (tag: string) => mockElement(tag),
        createElementNS: (_ns: string, tag: string) => mockElement(tag),
      };

      let clickedFeature: any = null;
      let clickedCoords: any = null;

      const feature: any = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [124.0, 15.5] },
        properties: {
          typhoon_name: 'KRISTINE (TRAMI)',
          typhoon_type: 'TY',
          date_label: 'Oct 22, 8:00 AM',
          is_current: true,
        },
      };

      const container = createCurrentStormMarkerElement(feature, (f, coords) => {
        clickedFeature = f;
        clickedCoords = coords;
      });

      expect(container).toBeDefined();
      expect(container?.className).toBe('gakit-typhoon-marker-container');

      // Verify no SVG or leader line is created
      const svg = (container as any)?.children.find((c: any) => c.tagName === 'SVG');
      expect(svg).toBeUndefined();

      // Check Slate Date Label (no line, no card, no "Current", no bullet)
      const label = (container as any)?.children.find((c: any) => c.className === 'gakit-typhoon-date-label');
      expect(label).toBeDefined();
      expect(label.textContent).toBe('Oct 22, 8:00 AM');
      expect(label.innerHTML).not.toContain('Current');
      expect(label.innerHTML).not.toContain('●');

      // Check click listener
      expect(listeners['click']).toBeDefined();
      listeners['click']({ stopPropagation: () => {} } as any);
      expect(clickedFeature).toEqual(feature);
      expect(clickedCoords).toEqual([124.0, 15.5]);
    } finally {
      (global as any).document = originalDoc;
    }
  });

  it('safely handles marker clearing and syncing lifecycle', () => {
    let removedCount = 0;
    const mockMarkers = [
      { remove: () => { removedCount++; } },
      { remove: () => { removedCount++; } },
    ];

    clearCurrentStormMarkers(mockMarkers);
    expect(removedCount).toBe(2);

    // Handles null / empty safely
    expect(() => clearCurrentStormMarkers(null as any)).not.toThrow();
    expect(() => clearCurrentStormMarkers([])).not.toThrow();
    expect(syncCurrentStormMarkers(null, null, null)).toEqual([]);
  });
});
