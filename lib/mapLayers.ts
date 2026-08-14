import { toast } from 'react-toastify';
import {
  MAPTILER_TERRAIN_STYLE,
  REPORT_MARKER_COLORS,
  REPORT_MARKER_IMAGE_IDS,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_LEGEND,
} from '@/constants/publicMap';
import type { DepthCategory, MapReportFeature, ReportStatus } from '@/types/report';

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

export const createReportMarkerImage = (color: string): ImageData | null => {
  const canvas = document.createElement('canvas');
  canvas.width = 72;
  canvas.height = 88;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const drawPin = () => {
    context.beginPath();
    context.moveTo(36, 82);
    context.bezierCurveTo(31, 70, 10, 52, 10, 33);
    context.bezierCurveTo(10, 18.5, 21.5, 7, 36, 7);
    context.bezierCurveTo(50.5, 7, 62, 18.5, 62, 33);
    context.bezierCurveTo(62, 52, 41, 70, 36, 82);
    context.closePath();
  };

  context.save();
  context.shadowColor = 'rgba(15, 23, 42, 0.35)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 5;
  drawPin();
  context.fillStyle = color;
  context.fill();
  context.restore();

  drawPin();
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 4;
  context.lineJoin = 'round';
  context.stroke();

  context.beginPath();
  context.arc(36, 32, 15, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();

  context.strokeStyle = color;
  context.lineWidth = 3.5;
  context.lineCap = 'round';
  [28, 35].forEach((y) => {
    context.beginPath();
    context.moveTo(24, y);
    context.bezierCurveTo(28, y - 3, 32, y + 3, 36, y);
    context.bezierCurveTo(40, y - 3, 44, y + 3, 48, y);
    context.stroke();
  });

  return context.getImageData(0, 0, canvas.width, canvas.height);
};

export const formatDepth = (depth: DepthCategory) =>
  depth.code === 'overhead'
    ? `${depth.label} (approximately ${depth.approximateCm} cm or deeper)`
    : `${depth.label} (approximately ${depth.approximateCm} cm)`;

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch
  );

export interface SubmittedReportProps {
  id: string;
  location: { lat: number; lng: number; address: string };
  depth: DepthCategory;
  status: ReportStatus;
  submittedAt: string;
}

export const buildReportsGeoJson = (
  backendReports: MapReportFeature[],
  submittedReports: SubmittedReportProps[],
  visibleStatuses: Record<ReportStatus, boolean>
) => {
  // The map's own fetch and the page-level `submittedReports` carry the same
  // API reports, so dedupe by id to avoid double-counting in clusters. Skip
  // hidden statuses up front so we don't build props for features that won't
  // be rendered.
  const seen = new Set<string>();
  const features: Array<Record<string, any>> = [];

  const pushReport = (
    id: string | undefined,
    status: ReportStatus,
    feature: Record<string, any>
  ) => {
    if (!id || seen.has(id)) return;
    if (!visibleStatuses[status]) return;
    seen.add(id);
    features.push(feature);
  };

  backendReports.forEach((feature) => {
    const props = feature.properties;
    pushReport(props.id, props.status, {
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        kind: 'report',
        status: props.status,
        address: props.address || 'Flood report',
        depthLabel: props.depth.label,
        statusLabel: REPORT_STATUS_LABELS[props.status] || props.status,
        createdAt: new Date(props.createdAt).toLocaleString(),
      },
    });
  });

  submittedReports.forEach((report) => {
    pushReport(report.id, report.status, {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [report.location.lng, report.location.lat],
      },
      properties: {
        kind: 'report',
        status: report.status,
        address: report.location.address,
        depthLabel: formatDepth(report.depth),
        statusLabel: REPORT_STATUS_LABELS[report.status],
        createdAt: report.submittedAt,
      },
    });
  });

  return {
    type: 'FeatureCollection',
    features,
  };
};

export const buildSelectedGeoJson = (selectedLocation: { lat: number; lng: number } | null) => {
  if (!selectedLocation) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [selectedLocation.lng, selectedLocation.lat],
        },
        properties: { kind: 'selected' },
      },
    ],
  };
};

export const buildReportPopupHtml = (feature: Record<string, any>): string => {
  const props = feature.properties ?? {};
  const coordinates = feature.geometry?.coordinates ?? [0, 0];
  const [lng, lat] = coordinates;
  const tooltipStyle = 'font-family: var(--font-inter), system-ui, sans-serif;';
  const row = (label: string, value: string) => `
    <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px; line-height: 1.6;">
      <span style="color: #64748b;">${escapeHtml(label)}</span>
      <span style="color: #0f172a; font-weight: 600;">${escapeHtml(value)}</span>
    </div>`;

  if (props.kind === 'selected') {
    return `
      <div class="gakit-tooltip" style="${tooltipStyle}">
        <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 4px;">
          Selected location
        </div>
        ${row('Coordinates', `${lat.toFixed(4)}, ${lng.toFixed(4)}`)}
      </div>`;
  }

  return `
    <div class="gakit-tooltip" style="${tooltipStyle}">
      <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 4px;">
        ${escapeHtml(props.address || 'Flood report')}
      </div>
      ${props.depthLabel ? row('Depth', props.depthLabel) : ''}
      ${props.statusLabel ? row('Status', props.statusLabel) : ''}
      ${props.createdAt ? row('Reported', props.createdAt) : ''}
    </div>`;
};

// Flood hazard colors — single source of truth for layers + legend
export const FLOOD_HAZARD_COLORS: Record<string, string> = {
  high: '#1D4ED8',
  medium: '#0891B2',
  low: '#BAE6FD',
};

export const FLOOD_HAZARD_LEGEND: Array<{ key: string; label: string; color: string }> = [
  { key: 'high', label: 'High hazard', color: FLOOD_HAZARD_COLORS.high },
  { key: 'medium', label: 'Medium hazard', color: FLOOD_HAZARD_COLORS.medium },
  { key: 'low', label: 'Low hazard', color: FLOOD_HAZARD_COLORS.low },
];

// Near real-time rainfall (JAXA GSMaP_NOW) scale, in mm/hour.
export const RAINFALL_LEGEND_STOPS: Array<{ label: string; color: string }> = [
  { label: 'Light', color: 'rgba(33,102,172,0.7)' },
  { label: 'Moderate', color: 'rgba(103,169,207,0.8)' },
  { label: 'Heavy', color: 'rgba(254,201,0,0.9)' },
  { label: 'Intense', color: 'rgba(252,90,13,0.95)' },
  { label: 'Extreme', color: 'rgba(203,24,29,1)' },
];

export const RAINFALL_GRADIENT_CSS = `linear-gradient(to right, ${RAINFALL_LEGEND_STOPS.map(
  (stop) => stop.color
).join(', ')})`;

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
}

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

      map.addLayer({
        id: 'flood-hazard-outline',
        type: 'line',
        source: 'flood-hazard',
        'source-layer': 'flood-zones',
        paint: {
          'line-color': [
            'match',
            ['get', 'risk_level'],
            'high',    FLOOD_HAZARD_COLORS.high,
            'medium',  FLOOD_HAZARD_COLORS.medium,
            'low',     FLOOD_HAZARD_COLORS.low,
            '#999999',
          ],
          'line-width': 1.5,
          'line-opacity': 0.6,
        },
      });
    }

    // --- Near real-time rainfall grid (JAXA GSMaP_NOW) ---
    if (!map.getSource('rainfall')) {
      map.addSource('rainfall', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        attribution:
          'Rainfall: <a href="https://sharaku.eorc.jaxa.jp/GSMaP_NOW/" target="_blank" rel="noopener">JAXA GSMaP_NOW</a>',
      });

      map.addLayer({
        id: 'rainfall-grid',
        type: 'fill',
        source: 'rainfall',
        maxzoom: 0,
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'precip_mm'],
            0, 'rgba(33,102,172,0)',
            0.5, 'rgba(33,102,172,0.7)',
            5, 'rgba(103,169,207,0.9)',
            15, 'rgba(254,201,0,0.95)',
            30, 'rgba(252,90,13,1)',
            50, 'rgba(203,24,29,1)',
          ],
          'fill-opacity': 0.8,
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
    ['flood-hazard-outline', state.showFloodHazard],
    ['rainfall-grid', state.showRainfall],
  ];
  initialLayers.forEach(([id, visible]) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  });

  const initialFilter = riskLevelFilter(state.visibleRiskLevels);
  if (map.getLayer('flood-hazard-fill')) map.setFilter('flood-hazard-fill', initialFilter);
  if (map.getLayer('flood-hazard-outline')) map.setFilter('flood-hazard-outline', initialFilter);

  // --- Report markers as clustered GeoJSON (GPU-rendered, no DOM churn) ---
  if (!map.getSource('reports')) {
    map.addSource('reports', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 30,
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
