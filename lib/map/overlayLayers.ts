import { toast } from 'react-toastify';
import {
  MAPTILER_TERRAIN_MAX_ZOOM,
  MAPTILER_TERRAIN_STYLE,
  MAPTILER_TERRAIN_TILE_SIZE,
  REPORT_MARKER_COLORS,
  REPORT_MARKER_IMAGE_IDS,
  REPORT_STATUS_LEGEND,
} from '@/constants/publicMap';
import { buildRainfallPaintExpression, FLOOD_HAZARD_COLORS } from '@/lib/map/colorScales';
import { HIMAWARI_COORDINATES, HIMAWARI_PLACEHOLDER_DATA_URL } from '@/lib/map/himawari';
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

export interface OverlayLayerState {
  showFloodHazard: boolean;
  showRainfall: boolean;
  showHimawariIR: boolean;
  visibleRiskLevels: Record<string, boolean>;
  mapMode: MapMode;
  rainfallHours: number;
}

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
        url: 'pmtiles:///data/flood-zones.pmtiles',
        attribution:
          'Flood data: <a href="https://noah.upd.edu.ph/" target="_blank" rel="noopener">Project NOAH</a> (ODbL)',
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
          'fill-opacity': 0.25,
        },
      });
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

  // Apply current toggle state (handles case where user toggled before load)
  const initialLayers: Array<[string, boolean]> = [
    ['flood-hazard-fill', state.showFloodHazard],
    ['rainfall-grid', state.showRainfall],
  ];
  initialLayers.forEach(([id, visible]) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  });

  const initialFilter = riskLevelFilter(state.visibleRiskLevels);
  if (map.getLayer('flood-hazard-fill')) map.setFilter('flood-hazard-fill', initialFilter);

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

  if (!map.getSource('selected-location')) {
    map.addSource('selected-location', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'selected-location-shadow',
      type: 'circle',
      source: 'selected-location',
      paint: {
        'circle-color': '#260008',
        'circle-opacity': 0.32,
        'circle-radius': 23,
        'circle-blur': 0.7,
        'circle-translate': [0, 7],
      },
    });

    map.addLayer({
      id: 'selected-location',
      type: 'circle',
      source: 'selected-location',
      paint: {
        'circle-color': '#7A0019',
        'circle-opacity': 0.24,
        'circle-radius': 21,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#7A0019',
        'circle-stroke-opacity': 0.55,
      },
    });

    map.addLayer({
      id: 'selected-location-highlight',
      type: 'circle',
      source: 'selected-location',
      paint: {
        'circle-color': '#ffffff',
        'circle-opacity': 0.18,
        'circle-radius': 13,
        'circle-blur': 0.45,
        'circle-translate': [-4, -4],
      },
    });

    map.addLayer({
      id: 'selected-location-label',
      type: 'symbol',
      source: 'selected-location',
      layout: {
        'text-field': 'Selected location',
        'text-size': 12,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-offset': [0, 1.9],
        'text-anchor': 'top',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#7A0019',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
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
    });

    // Subtle outline; hover bumps width/opacity. Kept below report pins.
    map.addLayer({
      id: 'barangay-outline',
      type: 'line',
      source: 'barangay-boundaries',
      before: 'report-clusters',
      paint: {
        'line-color': 'rgba(56, 189, 248, 0.5)',
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          2,
          1,
        ],
        'line-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.9,
          0.6,
        ],
      },
    });

    // Subtle fill; also the hover hit-target (thin outline is missable).
    map.addLayer({
      id: 'barangay-fill',
      type: 'fill',
      source: 'barangay-boundaries',
      before: 'report-clusters',
      paint: {
        'fill-color': 'rgba(56, 189, 248, 0.04)',
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          1.0,
          0.04,
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
        // Same hue as the boundary line.
        'text-color': '#38bdf8'
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
    }, 'report-clusters');

    map.setLayoutProperty('himawari-ir-layer', 'visibility', state.showHimawariIR ? 'visible' : 'none');
  }

  // Keep barangay layer below all report overlays regardless of add order.
  if (map.getLayer('barangay-outline') && map.getLayer('report-clusters')) {
    map.moveLayer('barangay-fill', 'report-clusters');
    map.moveLayer('barangay-label', 'report-clusters');
    map.moveLayer('barangay-outline', 'report-clusters');
  }

  // --- 3D terrain + hillshade (MapTiler view) ---
  if (state.mapMode === '3d') {
    if (!map.getSource('terrain')) {
      map.addSource('terrain', {
        type: 'raster-dem',
        url: MAPTILER_TERRAIN_STYLE,
        tileSize: MAPTILER_TERRAIN_TILE_SIZE,
        maxzoom: MAPTILER_TERRAIN_MAX_ZOOM,
      });
    }
    map.setTerrain({ source: 'terrain', exaggeration: 1 });
    // Hillshade needs its own DEM source (separate cache from terrain).
    if (!map.getSource('hillshade-dem')) {
      map.addSource('hillshade-dem', {
        type: 'raster-dem',
        url: MAPTILER_TERRAIN_STYLE,
        tileSize: MAPTILER_TERRAIN_TILE_SIZE,
        maxzoom: MAPTILER_TERRAIN_MAX_ZOOM,
      });
      map.addLayer({
        id: 'hillshade',
        type: 'hillshade',
        source: 'hillshade-dem',
        // Shade only the basemap/terrain — keep it below the data overlays so
        // report pins, flood fills, and rainfall aren't washed out by the relief.
        before: 'flood-hazard-fill',
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
    if (map.getSource('hillshade-dem')) map.removeSource('hillshade-dem');
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
