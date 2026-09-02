import type { StyleSpecification } from 'maplibre-gl';
import { ILIGAN_BOUNDS } from '@/lib/map/geoUtils';
import { HIMAWARI_IMAGE_BOUNDS } from '@/lib/map/himawari';
import type { ReportStatus } from '@/types/report';

// 2D & 3D basemap — OpenFreeMap Positron (vector, no API key needed).
export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

// Flat basemap choices (orthogonal to the 2D/3D mode toggle).
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

// AWS Open Data Terrarium raster DEM for 3D terrain.
// Native Mapzen DEM resolution is ~30m (SRTM), which corresponds to zoom 12 (~37m/pixel in Iligan).
// Capping maxzoom at 12 allows MapLibre to interpolate elevation on GPU at higher zooms,
// eliminating 90%+ of redundant HTTP tile fetches and eliminating tile request thrashing.
export const AWS_TERRAIN_TILES = [
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
];
export const AWS_TERRAIN_TILE_SIZE = 256;
export const AWS_TERRAIN_MAX_ZOOM = 12;
export const AWS_TERRAIN_ENCODING = 'terrarium' as const;

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
