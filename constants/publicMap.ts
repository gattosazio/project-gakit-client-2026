import type { StyleSpecification } from 'maplibre-gl';
import { ILIGAN_BOUNDS } from '@/lib/map/geoUtils';
import { HIMAWARI_IMAGE_BOUNDS } from '@/lib/map/himawari';
import type { ReportStatus } from '@/types/report';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

export const HAS_MAPTILER = Boolean(MAPTILER_KEY);

// 2D basemap — no API key needed.
export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

// 3D-capable vector basemap (MapTiler), only when a key is present. Used for
// the light + terrain preset; terrain DEM is layered on top.
export const MAPTILER_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : OPENFREEMAP_STYLE;

// Flat basemap choices (orthogonal to the 2D/3D mode toggle). Both work
// without an API key; 3D terrain is layered on top via MapTiler's DEM.
export type BasemapId = 'light' | 'satellite';

export const BASEMAP_LABELS: Record<BasemapId, string> = {
  light: 'Light',
  satellite: 'Satellite',
};

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'esri-imagery', type: 'raster', source: 'esri-imagery' }],
};

export const BASEMAP_STYLES: Record<BasemapId, string | StyleSpecification> = {
  light: OPENFREEMAP_STYLE,
  satellite: SATELLITE_STYLE,
};

// Raster DEM used to enable 3D terrain.
export const MAPTILER_TERRAIN_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`
  : '';

// MapTiler DEM serves 256px tiles; cap below the source max (14) so deep-zoom
// views reuse coarser elevation tiles instead of fetching extra DEM requests.
export const MAPTILER_TERRAIN_TILE_SIZE = 256;
export const MAPTILER_TERRAIN_MAX_ZOOM = 12;

export const ILIGAN_REPORT_BOUNDS = {
  west: ILIGAN_BOUNDS[0][0],
  south: ILIGAN_BOUNDS[0][1],
  east: ILIGAN_BOUNDS[1][0],
  north: ILIGAN_BOUNDS[1][1],
  limit: 500,
};

// Pan limits derived from the Himawari se2 swath, expanded by one full swath
// width/height in every direction. MapLibre's maxBounds constrain keeps the
// viewport edges inside these walls (so the imagery can never clip) and — on
// wide viewports — caps zoom-out so the viewport width never exceeds the
// bounds' width. The zoom-out floor itself is computed per-device from the
// swath fit in PublicMap via cameraForBounds.
const SWATH = HIMAWARI_IMAGE_BOUNDS;
const LNG_SPAN = SWATH[1][0] - SWATH[0][0];
const LAT_SPAN = SWATH[1][1] - SWATH[0][1];

export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [SWATH[0][0] - LNG_SPAN, SWATH[0][1] - LAT_SPAN],
  [SWATH[1][0] + LNG_SPAN, SWATH[1][1] + LAT_SPAN],
];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  UNVERIFIED: 'Pending validation',
  VERIFIED: 'Verified',
  ANOMALY: 'Flagged for review',
  REJECTED: 'Rejected',
};

export const REPORT_MARKER_COLORS: Record<ReportStatus, string> = {
  UNVERIFIED: '#F59E0B',
  VERIFIED: '#2563EB',
  ANOMALY: '#DC2626',
  REJECTED: '#64748B',
};

export const REPORT_MARKER_IMAGE_IDS: Record<ReportStatus, string> = {
  UNVERIFIED: 'report-marker-pending',
  VERIFIED: 'report-marker-verified',
  ANOMALY: 'report-marker-flagged',
  REJECTED: 'report-marker-rejected',
};

export const REPORT_STATUS_LEGEND: Array<{
  status: ReportStatus;
  label: string;
}> = [
  { status: 'UNVERIFIED', label: 'Pending' },
  { status: 'VERIFIED', label: 'Verified' },
  { status: 'ANOMALY', label: 'Flagged' },
  { status: 'REJECTED', label: 'Rejected' },
];
