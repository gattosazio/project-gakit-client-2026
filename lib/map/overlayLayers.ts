import { toast } from 'react-toastify';
import {
  AWS_TERRAIN_ENCODING,
  AWS_TERRAIN_MAX_ZOOM,
  AWS_TERRAIN_TILES,
  AWS_TERRAIN_TILE_SIZE,
  BasemapId,
  REPORT_MARKER_COLORS,
  REPORT_MARKER_IMAGE_IDS,
  REPORT_STATUS_LEGEND,
} from '@/constants/publicMap';
import {
  buildRainfallPaintExpression,
  FLOOD_HAZARD_COLORS,
  LANDSLIDE_COLORS,
  STORM_SURGE_HAZ_COLORS,
} from '@/lib/map/colorScales';
import { HIMAWARI_COORDINATES, HIMAWARI_PLACEHOLDER_DATA_URL } from '@/lib/map/himawari';
import {
  PAR_BOUNDARY_GEOJSON,
  TYPHOON_CATEGORY_CONFIG,
  DEFAULT_TYPHOON_COLOR,
} from '@/lib/map/typhoon';
import { createReportMarkerImage } from '@/lib/map/reportMarkers';

export type MapMode = '2d' | '3d';
// The pmtiles protocol handler must only be registered once per page load;
// switching styles re-runs style loading, so guard against double registration.
let pmtilesProtocolRegistered = false;

const registerPmtilesProtocol = async (maplibregl: any) => {
  if (pmtilesProtocolRegistered) return;
  const pmtiles = await import('pmtiles');
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesProtocolRegistered = true;
};

export const riskLevelFilter = (visible: Record<string, boolean>) => [
  'in',
  'risk_level',
  ...Object.keys(FLOOD_HAZARD_COLORS).filter((level) => visible[level]),
];

export const landslideFilter = (visible: Record<string, boolean>) => {
  const allowed: number[] = [];
  if (visible.low) allowed.push(1);
  if (visible.medium) allowed.push(2);
  if (visible.high) allowed.push(3);
  return [
    'in',
    ['to-number', ['get', 'LH']],
    ['literal', allowed],
  ];
};

export interface OverlayLayerState {
  showFloodHazard: boolean;
  showRainfall: boolean;
  showHimawariIR: boolean;
  showTyphoonTrack?: boolean;
  showBarangayBoundaries?: boolean;
  showBuildings?: boolean;
  visibleRiskLevels: Record<string, boolean>;
  showLandslide: boolean;
  visibleLandslideLevels: Record<string, boolean>;
  showStormSurge: boolean;
  stormSurgeAdvisory: 1 | 2 | 3 | 4 | null;
  mapMode: MapMode;
  rainfallHours: number;
  basemap?: BasemapId;
}

// Toggles visibility for building footprint layer (automatically shown in 3D Base mode, hidden in 2D or Satellite).
export const applyBuildingsVisibility = (
  map: any,
  mode: MapMode,
  basemap?: BasemapId
) => {
  try {
    if (map?.isStyleLoaded && !map.isStyleLoaded()) return;
    if (map?.getLayer && map.getLayer('iligan-buildings-3d')) {
      const isSatellite = basemap === 'satellite';
      const shouldShow = mode === '3d' && !isSatellite;
      map.setLayoutProperty(
        'iligan-buildings-3d',
        'visibility',
        shouldShow ? 'visible' : 'none'
      );
    }
  } catch {
    /* style not loaded yet */
  }
};

// Toggles visibility for all barangay boundary layers.
export const applyBarangayBoundariesVisibility = (map: any, visible: boolean) => {
  const vis = visible ? 'visible' : 'none';
  ['barangay-outline-casing', 'barangay-outline', 'barangay-fill'].forEach((id) => {
    if (map?.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', vis);
    }
  });
  if (!visible && map?.getLayer('barangay-label')) {
    map.setLayoutProperty('barangay-label', 'visibility', 'none');
  }
};

// Recolors the rainfall grid for the currently selected accumulation window.
export const applyRainfallPaint = (map: any, hours: number) => {
  if (!map?.getLayer('rainfall-grid')) return;
  map.setPaintProperty('rainfall-grid', 'fill-color', buildRainfallPaintExpression(hours));
};

// Animated pulse on the individual-pin halos, driven by one rAF loop per map.
// Transitions are disabled on the layers (above) so each frame applies
// instantly; the default 300ms transition would smear pings into a double
// pulse. Keyed by map in a WeakMap so a style reload can't start a second loop.
// Aggregated (cluster) pins are intentionally static — a pulsing ring under the
// count bubble adds clutter and fights a busy map, so only lone pins ping.
const pulseHandles = new WeakMap<object, number>();
const PING_PERIOD = 2000; // ms per sonar ping

export const startClusterPulse = (map: any) => {
  if (typeof window === 'undefined' || !map || pulseHandles.has(map)) return;
  const loop = (t: number) => {
    try {
      // Sawtooth 0..1: ring expands then resets (opacity ~0 at the wrap, so the
      // jump back to the start is invisible — no dead gap).
      const p = (t % PING_PERIOD) / PING_PERIOD;
      if (map.getLayer('report-point-halo')) {
        map.setPaintProperty('report-point-halo', 'circle-radius', 11 + p * 10);
        map.setPaintProperty('report-point-halo', 'circle-opacity', 0.5 * (1 - p * p * p));
      }
    } catch {
      pulseHandles.delete(map);
      return;
    }
    pulseHandles.set(map, requestAnimationFrame(loop));
  };
  pulseHandles.set(map, requestAnimationFrame(loop));
};

export const stopClusterPulse = (map: any) => {
  const id = pulseHandles.get(map);
  if (id != null) cancelAnimationFrame(id);
  pulseHandles.delete(map);
};

// Adds the project sources/layers (flood hazard, rainfall, reports,
// selected-location, 3D terrain) idempotently. Runs on the initial style load
// and again after every basemap switch (2D <-> 3D).
export const setupOverlayLayers = async (
  map: any,
  maplibregl: any,
  state: OverlayLayerState
) => {
  try {
    await registerPmtilesProtocol(maplibregl);

    // --- Flood hazard vector tile layer (PMTiles) ---
    if (!map.getSource('flood-hazard')) {
      map.addSource('flood-hazard', {
        type: 'vector',
        url: 'pmtiles:///data/lanao-del-norte-flood-zones.pmtiles',
        attribution:
          'Flood data: <a href="https://noah.upd.edu.ph/" target="_blank" rel="noopener">UP RI NOAH</a> (ODbL)',
      });

      map.addLayer({
        id: 'flood-hazard-fill',
        type: 'fill',
        source: 'flood-hazard',
        'source-layer': 'flood-zones',
        paint: {
          'fill-color': [
            'match',
            ['get', 'risk_level'],
            'high',    FLOOD_HAZARD_COLORS.high,
            'medium',  FLOOD_HAZARD_COLORS.medium,
            'low',     FLOOD_HAZARD_COLORS.low,
            'rgba(0,0,0,0.15)',
          ],
          'fill-opacity': 0.75,
          'fill-antialias': false,
        },
      });
    }

    // --- Landslide susceptibility (PMTiles) ---
    if (!map.getSource('landslide')) {
      map.addSource('landslide', {
        type: 'vector',
        url: 'pmtiles:///data/lanao-del-norte-landslide.pmtiles',
        attribution:
          'Landslide data: <a href="https://noah.upd.edu.ph/" target="_blank" rel="noopener">UP RI NOAH</a>',
      });
      map.addLayer({
        id: 'landslide-fill',
        type: 'fill',
        source: 'landslide',
        'source-layer': 'landslide',
        paint: {
          'fill-color': [
            'match',
            ['get', 'LH'],
            1, LANDSLIDE_COLORS.low,
            2, LANDSLIDE_COLORS.medium,
            3, LANDSLIDE_COLORS.high,
            'rgba(0,0,0,0.15)',
          ],
          'fill-opacity': 0.75,
          'fill-antialias': false,
        },
      });
    }

    // --- Storm surge advisories 1..4 (one source per archive; single-active) ---
    for (const n of [1, 2, 3, 4] as const) {
      const sourceId = `storm-surge-ssa${n}`;
      const layerId = `storm-surge-ssa${n}-fill`;
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'vector',
          url: `pmtiles:///data/lanao-del-norte-storm-surge-ssa${n}.pmtiles`,
          attribution:
            'Storm surge: <a href="https://noah.upd.edu.ph/" target="_blank" rel="noopener">UP RI NOAH</a>',
        });
        map.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          'source-layer': `storm_surge_ssa${n}`,
          paint: {
            'fill-color': [
              'match',
              ['to-number', ['get', 'HAZ']],
              1, STORM_SURGE_HAZ_COLORS[1],
              2, STORM_SURGE_HAZ_COLORS[2],
              3, STORM_SURGE_HAZ_COLORS[3],
              STORM_SURGE_HAZ_COLORS[1],
            ],
            'fill-opacity': 0.75,
            'fill-antialias': false,
          },
        });
      }
    }

    // --- Near real-time rainfall grid (JAXA GSMaP) ---
    if (!map.getSource('rainfall')) {
      map.addSource('rainfall', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        attribution:
          'Rainfall: <a href="https://sharaku.eorc.jaxa.jp/GSMaP/" target="_blank" rel="noopener">JAXA GSMaP</a>',
      });

      map.addLayer({
        id: 'rainfall-grid',
        type: 'fill',
        source: 'rainfall',
        paint: {
          'fill-color': buildRainfallPaintExpression(state.rainfallHours),
          'fill-opacity': 0.6,
          'fill-antialias': false,
        },
      });
    }
  } catch (error) {
    console.error('Failed to load PMTiles flood hazard data', error);
    toast.error('Flood hazard map data could not be loaded.', {
      position: 'top-right',
      autoClose: 4000,
    });
  }


// --- PAR (Philippine Area of Responsibility) boundary ---
  if (!map.getSource('par-outline')) {
    map.addSource('par-outline', {
      type: 'geojson',
      data: PAR_BOUNDARY_GEOJSON,
      attribution:
        'Typhoon & PAR: <a href="https://panahon.gov.ph/" target="_blank" rel="noopener">DOST-PAGASA (PANaHON)</a>',
    });

    map.addLayer({
      id: 'par-boundary-line',
      type: 'line',
      source: 'par-outline',
      before: 'report-clusters',
      paint: {
        'line-color': '#d97706',
        'line-width': 1.2,
        'line-dasharray': [5, 4],
        'line-opacity': 0.7,
      },
    });

    map.addLayer({
      id: 'par-boundary-label',
      type: 'symbol',
      source: 'par-outline',
      before: 'report-clusters',
      layout: {
        'text-field': 'PAR Boundary (PAGASA)',
        'text-size': 10,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'symbol-placement': 'line',
        'text-offset': [0, -0.8],
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#b45309',
        'text-halo-color': 'rgba(255, 255, 255, 0.85)',
        'text-halo-width': 1.2,
      },
    });
  }

  // --- Official Typhoon Feed Source & Layers ---
  if (!map.getSource('typhoon-track')) {
    map.addSource('typhoon-track', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    // 1. Official Forecast Cone (subtle shaded envelope)
    map.addLayer({
      id: 'typhoon-forecast-cone-fill',
      type: 'fill',
      source: 'typhoon-track',
      before: 'report-clusters',
      filter: ['==', ['get', 'type'], 'smoothed_hull'],
      paint: {
        'fill-color': 'rgba(244, 63, 94, 0.09)',
        'fill-opacity': 1,
      },
    });

    map.addLayer({
      id: 'typhoon-forecast-cone-outline',
      type: 'line',
      source: 'typhoon-track',
      before: 'report-clusters',
      filter: ['==', ['get', 'type'], 'smoothed_hull'],
      paint: {
        'line-color': '#f43f5e',
        'line-width': 1.1,
        'line-dasharray': [4, 3],
        'line-opacity': 0.5,
      },
    });

    // 2. Track Line (Clean, high-definition storm polyline)
    map.addLayer({
      id: 'typhoon-track-line-glow',
      type: 'line',
      source: 'typhoon-track',
      before: 'report-clusters',
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': '#e11d48',
        'line-width': 3,
        'line-blur': 1,
        'line-opacity': 0.35,
      },
    });

    map.addLayer({
      id: 'typhoon-track-line',
      type: 'line',
      source: 'typhoon-track',
      before: 'report-clusters',
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': '#e11d48',
        'line-width': 2,
        'line-dasharray': [4, 2],
        'line-opacity': 0.9,
      },
    });

    // 3. Track Milestone Nodes (Prominent radar milestone discs)
    // Only renders nodes for official classifications ('STY', 'TY', 'STS', 'TS', 'TD', 'LPA')
    const officialCategoryFilter = [
      'all',
      ['==', ['geometry-type'], 'Point'],
      [
        'in',
        ['upcase', ['coalesce', ['get', 'typhoon_type'], '']],
        ['literal', ['STY', 'TY', 'STS', 'TS', 'TD', 'LPA']],
      ],
    ];

    map.addLayer({
      id: 'typhoon-track-point-halo',
      type: 'circle',
      source: 'typhoon-track',
      before: 'report-clusters',
      filter: officialCategoryFilter,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 9,
          6, 12.5,
          9, 16,
        ],
        'circle-color': [
          'match',
          ['upcase', ['coalesce', ['get', 'typhoon_type'], 'TY']],
          'STY', TYPHOON_CATEGORY_CONFIG.STY.color,
          'TY', TYPHOON_CATEGORY_CONFIG.TY.color,
          'STS', TYPHOON_CATEGORY_CONFIG.STS.color,
          'TS', TYPHOON_CATEGORY_CONFIG.TS.color,
          'TD', TYPHOON_CATEGORY_CONFIG.TD.color,
          'LPA', TYPHOON_CATEGORY_CONFIG.LPA.color,
          DEFAULT_TYPHOON_COLOR,
        ],
        'circle-opacity': 0.28,
        'circle-blur': 0.5,
      },
    });

    map.addLayer({
      id: 'typhoon-track-point-circle',
      type: 'circle',
      source: 'typhoon-track',
      before: 'report-clusters',
      filter: officialCategoryFilter,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 6,
          6, 7.5,
          9, 9.5,
        ],
        'circle-color': [
          'match',
          ['upcase', ['coalesce', ['get', 'typhoon_type'], 'TY']],
          'STY', TYPHOON_CATEGORY_CONFIG.STY.color,
          'TY', TYPHOON_CATEGORY_CONFIG.TY.color,
          'STS', TYPHOON_CATEGORY_CONFIG.STS.color,
          'TS', TYPHOON_CATEGORY_CONFIG.TS.color,
          'TD', TYPHOON_CATEGORY_CONFIG.TD.color,
          'LPA', TYPHOON_CATEGORY_CONFIG.LPA.color,
          DEFAULT_TYPHOON_COLOR,
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': 'rgba(255, 255, 255, 0.95)',
      },
    });

    map.addLayer({
      id: 'typhoon-track-point-dot',
      type: 'circle',
      source: 'typhoon-track',
      before: 'report-clusters',
      filter: officialCategoryFilter,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 2,
          6, 2.5,
          9, 3.2,
        ],
        'circle-color': '#ffffff',
      },
    });

    map.addLayer({
      id: 'typhoon-track-point-label',
      type: 'symbol',
      source: 'typhoon-track',
      before: 'report-clusters',
      filter: officialCategoryFilter,
      layout: {
        'text-field': ['get', 'typhoon_type'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 9.5,
          6, 11,
          9, 12.5,
        ],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': 'rgba(255, 255, 255, 0.95)',
        'text-halo-width': 1.5,
      },
    });
  }

    // Apply current toggle state (handles case where user toggled before load)
  const typhoonVis = state.showTyphoonTrack ?? false;
  const stormSurgeVis = state.showStormSurge ? state.stormSurgeAdvisory : null;
  const stormSurgeEntries: Array<[string, boolean]> = [1, 2, 3, 4].map((n) => [
    `storm-surge-ssa${n}-fill`,
    stormSurgeVis === n,
  ]);
  const initialLayers: Array<[string, boolean]> = [
    ['par-boundary-line', typhoonVis],
    ['par-boundary-label', typhoonVis],
    ['typhoon-forecast-cone-fill', typhoonVis],
    ['typhoon-forecast-cone-outline', typhoonVis],
    ['typhoon-track-line-glow', typhoonVis],
    ['typhoon-track-line', typhoonVis],
    ['typhoon-track-point-halo', typhoonVis],
    ['typhoon-track-point-circle', typhoonVis],
    ['typhoon-track-point-dot', typhoonVis],
    ['typhoon-track-point-label', typhoonVis],
    ['flood-hazard-fill', state.showFloodHazard],
    ['landslide-fill', state.showLandslide],
    ...stormSurgeEntries,
    ['rainfall-grid', state.showRainfall],
    ['barangay-outline-casing', state.showBarangayBoundaries ?? false],
    ['barangay-outline', state.showBarangayBoundaries ?? false],
    ['barangay-fill', state.showBarangayBoundaries ?? false],
  ];
  initialLayers.forEach(([id, visible]) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  });

  const initialFilter = riskLevelFilter(state.visibleRiskLevels);
  if (map.getLayer('flood-hazard-fill')) map.setFilter('flood-hazard-fill', initialFilter);
  const initialLandslideFilter = landslideFilter(state.visibleLandslideLevels);
  if (map.getLayer('landslide-fill')) map.setFilter('landslide-fill', initialLandslideFilter);

  // --- Report markers as clustered GeoJSON (GPU-rendered, no DOM churn) ---
  if (!map.getSource('reports')) {
    // Per-status counts let clusters inherit the dominant report status color.
    map.addSource('reports', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 15,
    });

    REPORT_STATUS_LEGEND.forEach(({ status }) => {
      const imageId = REPORT_MARKER_IMAGE_IDS[status];
      if (map.hasImage(imageId)) return;
      const image = createReportMarkerImage(REPORT_MARKER_COLORS[status]);
      if (image) map.addImage(imageId, image, { pixelRatio: 2 });
    });

    // Status colors for individual-pin glow (clusters stay neutral indigo).
    const statusColor = (expr: any) => [
      'match', expr,
      'VERIFIED', REPORT_MARKER_COLORS.VERIFIED,
      'ANOMALY', REPORT_MARKER_COLORS.ANOMALY,
      'REJECTED', REPORT_MARKER_COLORS.REJECTED,
      REPORT_MARKER_COLORS.UNVERIFIED,
    ];

    // Solid cluster disc (neutral indigo), radius scales with count but is
    // capped so clusters don't balloon when zoomed out.
    map.addLayer({
      id: 'report-clusters',
      type: 'circle',
      source: 'reports',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#6366f1',
        'circle-radius': [
          'interpolate', ['linear'], ['get', 'point_count'],
          2, 11, 5, 12.5, 10, 14, 25, 16, 50, 17,
        ],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.9,
      },
    });

    map.addLayer({
      id: 'report-cluster-count',
      type: 'symbol',
      source: 'reports',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 13,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: { 'text-color': '#ffffff' },
    });

    // Soft glow behind individual pins.
    map.addLayer({
      id: 'report-point-halo',
      type: 'circle',
      source: 'reports',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': statusColor(['get', 'status']),
        'circle-radius': 11,
        'circle-blur': 0.5,
        'circle-opacity': 0.32,
        'circle-radius-transition': { duration: 0 },
        'circle-opacity-transition': { duration: 0 },
      },
    });

    map.addLayer({
      id: 'report-points',
      type: 'symbol',
      source: 'reports',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': [
          'match',
          ['get', 'status'],
          'VERIFIED', REPORT_MARKER_IMAGE_IDS.VERIFIED,
          'ANOMALY', REPORT_MARKER_IMAGE_IDS.ANOMALY,
          'REJECTED', REPORT_MARKER_IMAGE_IDS.REJECTED,
          REPORT_MARKER_IMAGE_IDS.UNVERIFIED,
        ],
        'icon-anchor': 'center',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }



  // --- Iligan barangay boundaries ---
  if (!map.getSource('barangay-boundaries')) {
    map.addSource('barangay-boundaries', {
      type: 'geojson',
      data: '/data/iligan-barangays.geojson',
      // Use the barangay PSGC code as the feature id so setFeatureState
      // (used for hover highlighting) can resolve and update each polygon.
      promoteId: 'adm4_psgc',
      attribution:
        'Boundaries: <a href="https://namria.gov.ph/" target="_blank" rel="noopener">NAMRIA / PSA</a>',
    });

    const isSatellite = state.basemap === 'satellite';
    const boundaryColor = '#06b6d4';
    const boundaryCasingColor = isSatellite ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    const boundaryFillColor = '#06b6d4';
    const labelColor = isSatellite ? '#22d3ee' : '#0891b2';
    const labelHaloColor = isSatellite ? '#0f172a' : '#ffffff';
    const boundaryVisibility = (state.showBarangayBoundaries ?? false) ? 'visible' : 'none';

    // High-contrast casing line below the boundary stroke; grows prominently on hover.
    map.addLayer({
      id: 'barangay-outline-casing',
      type: 'line',
      source: 'barangay-boundaries',
      before: 'report-clusters',
      layout: {
        visibility: boundaryVisibility,
      },
      paint: {
        'line-color': boundaryCasingColor,
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          5,
          2.5,
        ],
        'line-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.95,
          0.6,
        ],
      },
    });

    // Main boundary outline; grows from 1.25px to 3px on hover.
    map.addLayer({
      id: 'barangay-outline',
      type: 'line',
      source: 'barangay-boundaries',
      before: 'report-clusters',
      layout: {
        visibility: boundaryVisibility,
      },
      paint: {
        'line-color': boundaryColor,
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          3,
          1.25,
        ],
        'line-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          1.0,
          0.85,
        ],
      },
    });

    // Boundary fill: provides an evident translucent highlight across the hovered polygon.
    map.addLayer({
      id: 'barangay-fill',
      type: 'fill',
      source: 'barangay-boundaries',
      before: 'report-clusters',
      layout: {
        visibility: boundaryVisibility,
      },
      paint: {
        'fill-color': boundaryFillColor,
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          isSatellite ? 0.22 : 0.16,
          0.02,
        ],
      },
    });
  }

  // Hovered barangay name, rendered at the polygon centroid from a point source.
  if (!map.getSource('barangay-label-point')) {
    map.addSource('barangay-label-point', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    const isSatellite = state.basemap === 'satellite';
    const labelColor = isSatellite ? '#22d3ee' : '#0891b2';
    const labelHaloColor = isSatellite ? '#0f172a' : '#ffffff';

    map.addLayer({
      id: 'barangay-label',
      type: 'symbol',
      source: 'barangay-label-point',
      before: 'report-clusters',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-font': ['Inter Bold'],
        'text-anchor': 'center',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': labelColor,
        'text-halo-color': labelHaloColor,
        'text-halo-width': 2,
      },
    });

    map.setLayoutProperty('barangay-label', 'visibility', 'none');
  }

  // --- Himawari IR satellite imagery (JMA) ---
  if (!map.getSource('himawari-ir')) {
    // Seed with a transparent 1x1 so MapLibre never fires an AJAX at a JMA
    // slot that may 404 (publish gaps / stale frames). The animation loop in
    // useHimawariLayer swaps in real frames via updateImage once preloaded.
    map.addSource('himawari-ir', {
      type: 'image',
      url: HIMAWARI_PLACEHOLDER_DATA_URL,
      coordinates: HIMAWARI_COORDINATES,
    });

    map.addLayer({
      id: 'himawari-ir-layer',
      type: 'raster',
      source: 'himawari-ir',
      paint: {
        'raster-opacity': 0.8,
        // Snap frames instantly (PAGASA-style): MapLibre's 300 ms default fade
        // never settles at the ~167 ms loop interval and smears every swap.
        'raster-fade-duration': 0,
      },
    }, map.getLayer('flood-hazard-fill') ? 'flood-hazard-fill' : 'report-clusters');

    map.setLayoutProperty('himawari-ir-layer', 'visibility', state.showHimawariIR ? 'visible' : 'none');
  }

  // --- Iligan City building footprints (3D extrusion for 3D view only, PMTiles) ---
  if (!map.getSource('iligan-buildings')) {
    map.addSource('iligan-buildings', {
      type: 'vector',
      url: 'pmtiles:///data/iligan-buildings.pmtiles',
      attribution:
        'Buildings: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    });

    const isSatellite = state.basemap === 'satellite';
    const shouldShowBuildings = state.mapMode === '3d' && !isSatellite;

    // 3D building extrusion for 3D/terrain view only on Base map (hidden on Satellite)
    map.addLayer({
      id: 'iligan-buildings-3d',
      type: 'fill-extrusion',
      source: 'iligan-buildings',
      'source-layer': 'buildings',
      minzoom: 13,
      layout: {
        visibility: shouldShowBuildings ? 'visible' : 'none',
      },
      paint: {
        'fill-extrusion-color': '#cbd5e1',
        'fill-extrusion-height': 6,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.85,
      },
    });
  } else {
    // Keep visibility in sync when basemap/mode changes
    applyBuildingsVisibility(map, state.mapMode, state.basemap);
  }

// Guarantee layer stacking order:
  // Base -> Himawari Satellite -> 3D Buildings -> Flood Hazard -> Rainfall Grid -> Barangay -> PAR -> Typhoon Cone -> Typhoon Track -> Typhoon Points -> Report Pins
  const orderedLayers = [
    'himawari-ir-layer',
    'iligan-buildings-3d',
    'flood-hazard-fill',
    'landslide-fill',
    'storm-surge-ssa1-fill',
    'storm-surge-ssa2-fill',
    'storm-surge-ssa3-fill',
    'storm-surge-ssa4-fill',
    'rainfall-grid',
    'barangay-fill',
    'barangay-outline-casing',
    'barangay-outline',
    'barangay-label',
    'par-boundary-line',
    'par-boundary-label',
    'typhoon-forecast-cone-fill',
    'typhoon-forecast-cone-outline',
    'typhoon-track-line-glow',
    'typhoon-track-line',
    'typhoon-track-point-halo',
    'typhoon-track-point-circle',
    'typhoon-track-point-dot',
    'typhoon-track-point-label',
  ];

  if (map.getLayer('report-clusters')) {
    orderedLayers.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId, 'report-clusters');
      }
    });
  }

  // --- 3D terrain + hillshade (AWS Open Data Terrarium DEM) ---
  if (state.mapMode === '3d') {
    if (!map.getSource('terrain')) {
      map.addSource('terrain', {
        type: 'raster-dem',
        tiles: AWS_TERRAIN_TILES,
        tileSize: AWS_TERRAIN_TILE_SIZE,
        maxzoom: AWS_TERRAIN_MAX_ZOOM,
        encoding: AWS_TERRAIN_ENCODING,
      });
    }
    map.setTerrain({ source: 'terrain', exaggeration: 1 });
    // Hillshade reuses the same DEM source as terrain, so the elevation
    // tiles are fetched only once instead of twice per view.
    if (!map.getLayer('hillshade')) {
      map.addLayer({
        id: 'hillshade',
        type: 'hillshade',
        source: 'terrain',
        // Shade only the basemap/terrain — keep it below the data overlays so
        // report pins, flood fills, and rainfall aren't washed out by the relief.
        before: 'iligan-buildings-3d',
        paint: {
          'hillshade-exaggeration': 0.4,
          'hillshade-shadow-color': '#2b3c4e',
          'hillshade-highlight-color': '#ffffff',
        },
      });
    }
  } else {
    map.setTerrain(null);
    if (map.getLayer('hillshade')) map.removeLayer('hillshade');
  }

  // Pulse only in 2D. In 3D the halo layers are draped on terrain, so
  // animating them every frame would force a constant re-drape — a steady 3D
  // perf tax. Stop it in 3D (and on every style reload, idempotently).
  if (state.mapMode === '3d') {
    stopClusterPulse(map);
  } else {
    startClusterPulse(map);
  }
};
