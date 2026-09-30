import { describe, expect, it } from 'vitest';
import {
  buildTyphoonPopupHtml,
  enrichTyphoonTrackGeoJson,
  fetchHistoricalStorms,
  fetchTyphoonTrack,
  formatTrackDateLabel,
  formatTyphoonDisplayName,
  getTyphoonCategoryColor,
  getTyphoonCategoryLabel,
  isCoordInPar,
  PAR_BOUNDARY_GEOJSON,
  PRIMARY_TYPHOON_CATEGORIES,
  TYPHOON_CATEGORY_CONFIG,
} from '@/lib/map/typhoon';
import { convertPanahonToGeoJSON, isCycloneExpired, type PanahonCycloneItem } from '@/lib/map/panahon';
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

  it('prunes forecast cone, forecast radius, and current markers when enriching historical tracks', () => {
    const rawTrackWithCone = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'MultiPolygon', coordinates: [[[120, 15], [121, 16], [120, 16]]] },
          properties: { type: 'smoothed_hull', typhoon_name: 'QUEENIE' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [128.2, 25.4] },
          properties: {
            typhoon_name: 'QUEENIE',
            typhoon_type: 'TY',
            radius: 117,
            is_forecast: true,
            date: '2026-09-28',
            time: '14:00',
          },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [129.5, 27.0] },
          properties: {
            typhoon_name: 'QUEENIE',
            typhoon_type: 'STS',
            radius: 150,
            is_forecast: true,
            date: '2026-09-29',
            time: '02:00',
          },
        },
      ],
    };

    const enriched = enrichTyphoonTrackGeoJson(rawTrackWithCone, { isHistorical: true });
    expect(enriched.isHistorical).toBe(true);

    // 1. Forecast cone (smoothed_hull polygon) is omitted
    const polygons = enriched.features.filter(
      (f: any) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
    );
    expect(polygons.length).toBe(0);

    // 2. All points have radius 0, is_forecast false, is_current false, empty current_label
    const points = enriched.features.filter((f: any) => f.geometry.type === 'Point');
    expect(points.length).toBe(2);
    for (const pt of points) {
      expect(pt.properties.radius).toBe(0);
      expect(pt.properties.is_forecast).toBe(false);
      expect(pt.properties.is_current).toBe(false);
      expect(pt.properties.current_label).toBe('');
      expect(pt.properties.is_historical).toBe(true);
    }

    // 3. Track lines are all solid past tracks (not dashed forecast)
    const lines = enriched.features.filter((f: any) => f.geometry.type === 'LineString');
    expect(lines.length).toBe(1);
    expect(lines[0].properties.track_type).toBe('past');
    expect(lines[0].properties.is_forecast).toBe(false);

    // 4. Popup HTML omits Forecast Radius for historical points
    const popupHtml = buildTyphoonPopupHtml(points[0].properties);
    expect(popupHtml).not.toContain('Forecast Radius');
    expect(popupHtml).toContain('QUEENIE');

    // 5. Option B: First and last points show date callouts, without is_current
    expect(points[0].properties.is_endpoint).toBe(true);
    expect(points[0].properties.show_date_callout).toBe(true);
    expect(points[1].properties.is_endpoint).toBe(true);
    expect(points[1].properties.show_date_callout).toBe(true);
  });

  it('displays minimal date callouts only at the first and last milestone points of historical tracks', () => {
    const multiPointTrack = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [136.2, 17.3] },
          properties: { typhoon_name: 'QUEENIE', typhoon_type: 'TS', date: '2026-09-24', time: '02:00' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [134.3, 17.7] },
          properties: { typhoon_name: 'QUEENIE', typhoon_type: 'TS', date: '2026-09-24', time: '08:00' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [133.3, 18.5] },
          properties: { typhoon_name: 'QUEENIE', typhoon_type: 'TS', date: '2026-09-24', time: '14:00' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [131.5, 27.4] },
          properties: { typhoon_name: 'QUEENIE', typhoon_type: 'TY', date: '2026-09-28', time: '14:00' },
        },
      ],
    };

    const enriched = enrichTyphoonTrackGeoJson(multiPointTrack, { isHistorical: true });
    const points = enriched.features.filter((f: any) => f.geometry.type === 'Point');
    expect(points.length).toBe(4);

    // First point (Genesis) -> minimal date callout
    expect(points[0].properties.show_date_callout).toBe(true);
    expect(points[0].properties.is_endpoint).toBe(true);
    expect(points[0].properties.date_label).toContain('Sep 24');

    // Intermediate points -> no date callout
    expect(points[1].properties.show_date_callout).toBe(false);
    expect(points[1].properties.is_endpoint).toBe(false);
    expect(points[2].properties.show_date_callout).toBe(false);
    expect(points[2].properties.is_endpoint).toBe(false);

    // Last point (Dissipation / Final observation) -> minimal date callout
    expect(points[3].properties.show_date_callout).toBe(true);
    expect(points[3].properties.is_endpoint).toBe(true);
    expect(points[3].properties.date_label).toContain('Sep 28');
  });

  it('normalizes raw agency categories like AA, LOW, PTC into official LPA nodes', () => {
    const rawTrackWithAA = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [128.8, 25.9] },
          properties: {
            typhoon_name: 'PILANDOK',
            typhoon_type: 'AA',
            date: '2026-09-06',
            time: '14:00',
          },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [129.5, 25.8] },
          properties: {
            typhoon_name: 'PILANDOK',
            typhoon_type: 'LOW',
            date: '2026-09-07',
            time: '02:00',
          },
        },
      ],
    };

    const enriched = enrichTyphoonTrackGeoJson(rawTrackWithAA);
    const points = enriched.features.filter((f: any) => f.geometry.type === 'Point');
    expect(points.length).toBe(2);
    expect(points[0].properties.typhoon_type).toBe('LPA');
    expect(points[1].properties.typhoon_type).toBe('LPA');

    const popupHtml = buildTyphoonPopupHtml(points[0].properties);
    expect(popupHtml).toContain('Low Pressure Area');
    expect(popupHtml).toContain('LPA');
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

  it('correctly determines whether coordinates are within PAR boundary', () => {
    // Inside PAR
    expect(isCoordInPar(121.0, 14.5)).toBe(true); // Manila
    expect(isCoordInPar(124.2, 8.2)).toBe(true); // Iligan
    expect(isCoordInPar(134.0, 24.0)).toBe(true); // Near northeastern edge

    // Outside PAR
    expect(isCoordInPar(128.2, 25.4)).toBe(false); // Queenie (north of 25°N)
    expect(isCoordInPar(136.0, 10.0)).toBe(false); // East of 135°E
    expect(isCoordInPar(114.0, 10.0)).toBe(false); // West of 115°E
  });

  it('detects expired storm data when last forecast point + 25h has elapsed', () => {
    const expiredInfo = {
      '2026-09-27 14:00': {
        cyclone_type: 'TY',
        date: '2026-09-27',
        time: '14:00',
        latitude: '25.4',
        longitude: '128.2',
        radius: '0',
      },
      '2026-09-28 14:00': {
        cyclone_type: 'TY',
        date: '2026-09-28',
        time: '14:00',
        latitude: '27.4',
        longitude: '131.5',
        radius: '117',
      },
    };
    expect(isCycloneExpired(expiredInfo)).toBe(true);

    const freshFutureDate = new Date(Date.now() + 12 * 3600 * 1000).toISOString().slice(0, 10);
    const activeInfo = {
      'latest': {
        cyclone_type: 'TY',
        date: freshFutureDate,
        time: '12:00',
        latitude: '15.0',
        longitude: '125.0',
        radius: '100',
      },
    };
    expect(isCycloneExpired(activeInfo)).toBe(false);
  });

  it('fetches historical storms via client API', async () => {
    const mockStorms = [
      { id: '1', name: 'QUEENIE', cycloneName: 'QUEENIE', category: 'TY', pointCount: 23 },
    ];
    const globalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any) => {
      if (String(url).includes('history=true')) {
        return {
          ok: true,
          json: async () => mockStorms,
        } as any;
      }
      return { ok: false, statusText: 'Not found' } as any;
    }) as any;

    const result = await fetchHistoricalStorms();
    expect(result).toHaveLength(1);
    expect(result[0].cycloneName).toBe('QUEENIE');

    globalThis.fetch = globalFetch;
  });

  it('fetches specific historical storm track with stormName query', async () => {
    let requestedUrl = '';
    const globalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any) => {
      requestedUrl = String(url);
      return {
        ok: true,
        json: async () => ({
          hasActiveTyphoon: false,
          isHistorical: true,
          stormName: 'QUEENIE (SURIGAE)',
          track: { type: 'FeatureCollection', features: [] },
          par: PAR_BOUNDARY_GEOJSON,
        }),
      } as any;
    }) as any;

    const result = await fetchTyphoonTrack('QUEENIE');
    expect(requestedUrl).toContain('stormName=QUEENIE');
    expect(result.isHistorical).toBe(true);
    expect(result.hasActiveTyphoon).toBe(false);

    globalThis.fetch = globalFetch;
  });
});
