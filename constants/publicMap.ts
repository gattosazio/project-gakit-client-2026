import type { LightSpecification, StyleSpecification } from 'maplibre-gl';
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

const ESRI_IMAGERY_TILE_TEMPLATE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

// Single-tile URL for the satellite basemap above. The report thumbnail reads
// the same tiles directly, so it can never drift from what the live map shows.
export const satelliteTileUrl = (z: number, x: number, y: number): string =>
  ESRI_IMAGERY_TILE_TEMPLATE.replace('{z}', String(z))
    .replace('{y}', String(y))
    .replace('{x}', String(x));

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: [ESRI_IMAGERY_TILE_TEMPLATE],
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

// Iligan building footprint paint (PMTiles) — shared by every map surface
// (public map 2D/3D layers and the scenario flood map) so extrusions always
// sit on the OpenFreeMap Positron basemap in the same warm grey, never the
// cool slate that reads as a foreign overlay.
export const BUILDING_FILL_COLOR = '#dfdeda';
export const BUILDING_FILL_OUTLINE_COLOR = '#d0ceca';
export const BUILDING_FILL_OPACITY = 0.65;
export const BUILDING_EXTRUSION_COLOR = '#dedcd7';
export const BUILDING_EXTRUSION_OPACITY = 0.75;
export const BUILDING_EXTRUSION_HEIGHT = 6;
export const BUILDING_EXTRUSION_BASE = 0;
export const BUILDINGS_MIN_ZOOM = 13;
export const BUILDINGS_PMTILES_URL = 'pmtiles:///data/iligan-buildings.pmtiles';

// Flattened 3D shading. MapLibre shades fill-extrusion walls with a vertical
// gradient (darker at the base) and lights them from a default 0.5-intensity
// key; both make extruded volumes read as shaded blocks. Every map surface
// therefore pins the gradient off and swaps in the same soft, near-ambient
// light, so buildings render as flat plates at a consistent brightness.
export const BUILDING_EXTRUSION_VERTICAL_GRADIENT = false;
export const FLAT_EXTRUSION_LIGHT: LightSpecification = {
  anchor: 'viewport',
  position: [1.15, 0, 0],
  color: '#ffffff',
  intensity: 0.25,
};

// Terrain relief: shared vertical exaggeration plus the deliberately faint
// hillshade that only hints at the ridges under the flat Positron basemap.
export const TERRAIN_EXAGGERATION = 1.15;
export const HILLSHADE_EXAGGERATION = 0.35;
export const HILLSHADE_SHADOW_COLOR = '#475569';
export const HILLSHADE_HIGHLIGHT_COLOR = '#ffffff';
export const HILLSHADE_ACCENT_COLOR = '#64748b';

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
