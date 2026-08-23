import { toast } from 'react-toastify';
import {
  MAPTILER_TERRAIN_STYLE,
  REPORT_MARKER_COLORS,
  REPORT_MARKER_IMAGE_IDS,
  REPORT_STATUS_LEGEND,
} from '@/constants/publicMap';
import { buildRainfallPaintExpression, FLOOD_HAZARD_COLORS } from '@/lib/map/colorScales';
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
  visibleRiskLevels: Record<string, boolean>;
  mapMode: MapMode;
  rainfallHours: number;
}

// Recolors the rainfall grid for the currently selected accumulation window.
export const applyRainfallPaint = (map: any, hours: number) => {
  if (!map?.getLayer('rainfall-grid')) return;
  map.setPaintProperty('rainfall-grid', 'fill-color', buildRainfallPaintExpression(hours));
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
    map.addSource('reports', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 11,
      clusterRadius: 25,
    });

    REPORT_STATUS_LEGEND.forEach(({ status }) => {
      const imageId = REPORT_MARKER_IMAGE_IDS[status];
      if (map.hasImage(imageId)) return;
      const image = createReportMarkerImage(REPORT_MARKER_COLORS[status]);
      if (image) map.addImage(imageId, image, { pixelRatio: 2 });
    });

    map.addLayer({
      id: 'report-clusters',
      type: 'circle',
      source: 'reports',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#6366f1',
        'circle-radius': 22,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });

    map.addLayer({
      id: 'report-cluster-count',
      type: 'symbol',
      source: 'reports',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 12,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      },
      paint: { 'text-color': '#ffffff' },
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
        'icon-anchor': 'bottom',
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

  // --- Himawari IR satellite imagery (JMA) ---
  // Frame layers are owned by useHimawariLayer (one raster layer per frame,
  // visibility-flipped for playback); nothing to create statically here.

  // --- 3D terrain (MapTiler view) ---
  if (state.mapMode === '3d') {
    if (!map.getSource('terrain')) {
      map.addSource('terrain', {
        type: 'raster-dem',
        url: MAPTILER_TERRAIN_STYLE,
        tileSize: 256,
      });
    }
    map.setTerrain({ source: 'terrain', exaggeration: 1.4 });
  } else {
    map.setTerrain(null);
  }
};
